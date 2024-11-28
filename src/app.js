import express, { json, urlencoded } from "express";
import { setupEnv } from "./utils/env.js";
import { connectDB } from "./db/config/mongoose.ts";
import * as Sentry from "@sentry/node";
import { setTag } from "@sentry/node";
import { chainMiddleware, contractMiddleware, transactionMiddleware } from "./middleware/chainMiddleware.js";
import { providerFactory } from "./chain-operations/providerFactory.js";
import { contractManager } from "./chain-operations/contractManager.js";
import { multiChainListener } from "./utils/multiChainListener.js";
import Issuer from "./db/objects/Issuer.js";

// Routes
import historicalTransactions from "./routes/historicalTransactions.js";
import mainRoutes from "./routes/index.js";
import issuerRoutes from "./routes/issuer.js";
import stakeholderRoutes from "./routes/stakeholder.js";
import stockClassRoutes from "./routes/stockClass.js";
import stockLegendRoutes from "./routes/stockLegend.js";
import stockPlanRoutes from "./routes/stockPlan.js";
import transactionRoutes from "./routes/transactions.js";
import valuationRoutes from "./routes/valuation.js";
import vestingTermsRoutes from "./routes/vestingTerms.js";
import statsRoutes from "./routes/stats/index.js";
import exportRoutes from "./routes/export.js";
import ocfRoutes from "./routes/ocf.js";

setupEnv();

// Initialize Sentry
Sentry.init({
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(urlencoded({ limit: "50mb", extended: true }));
app.use(json({ limit: "50mb" }));
app.enable("trust proxy");

// Chain-aware routes
app.use("/", mainRoutes);
app.use("/issuer", issuerRoutes);
app.use("/stakeholder", contractMiddleware, transactionMiddleware, stakeholderRoutes);
app.use("/stock-class", contractMiddleware, transactionMiddleware, stockClassRoutes);
app.use("/stock-legend", stockLegendRoutes);
app.use("/stock-plan", contractMiddleware, transactionMiddleware, stockPlanRoutes);
app.use("/valuation", valuationRoutes);
app.use("/vesting-terms", vestingTermsRoutes);
app.use("/historical-transactions", historicalTransactions);
app.use("/stats", statsRoutes);
app.use("/export", exportRoutes);
app.use("/ocf", ocfRoutes);
app.use("/transactions", contractMiddleware, transactionMiddleware, transactionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    Sentry.captureException(err);
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const startServer = async () => {
    try {
        // Connect to MongoDB
        console.log("Connecting to MongoDB...");
        await connectDB();
        console.log("Connected to MongoDB");

        // Start listening for blockchain events across all chains
        const issuers = await Issuer.find({ deployment_status: 'deployed' });
        for (const issuer of issuers) {
            try {
                await multiChainListener.startListener(issuer.deployed_to, issuer.chainId);
                console.log(`Started listener for issuer ${issuer.id} on chain ${issuer.chainId}`);
            } catch (error) {
                console.error(`Failed to start listener for issuer ${issuer.id}:`, error);
                Sentry.captureException(error);
            }
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server successfully launched on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        Sentry.captureException(error);
        process.exit(1);
    }
};

// Cleanup on shutdown
const cleanup = async () => {
    console.log('Shutting down server...');
    try {
        await providerFactory.cleanupAll();
        contractManager.clearCache();
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start server
startServer();
