import express, { json, urlencoded } from "express";
import { connectDB } from "./db/config/mongoose.ts";

import { startEventProcessing, stopEventProcessing } from "./chain-operations/transactionPoller.ts";

// Routes
import { capTable as capTableRoutes } from "./routes/capTable.ts";
import { router as factoryRoutes } from "./routes/factory.ts";
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

import mongoose from "mongoose";
import { readIssuerById } from "./db/operations/read.js";
import { getIssuerContract } from "./utils/caches.ts";
import { setupEnv } from "./utils/env.js";
import dashboard from "./routes/dashboard.js";
import exportRoutes from "./routes/export.js";
import * as Sentry from '@sentry/node';

setupEnv();

const isDev = process.env.NODE_ENV == "development"

Sentry.init({
  dsn: process.env.SENTRY_DNS,
  environment: process.env.NODE_ENV,
  tracesSampleRate: isDev? 1.0 : 0.1,
  sendDefaultPii: true,
});

const app = express();

const PORT = process.env.PORT;

// Middleware to get or create contract instance
// the listener is first started on deployment, then here as a backup
const contractMiddleware = async (req, res, next) => {
    if (!req.body.issuerId) {
        console.log("❌ | No issuer ID");
        return res.status(400).send("issuerId is required");
    }

    // fetch issuer to ensure it exists
    const issuer = await readIssuerById(req.body.issuerId);
    if (!issuer) return res.status(400).send("Issuer not found");

    const { contract, provider } = await getIssuerContract(issuer);
    req.contract = contract;
    req.provider = provider;
    next();
};
app.use(urlencoded({ limit: "50mb", extended: true }));
app.use(json({ limit: "50mb" }));
app.enable("trust proxy");

app.use("/", mainRoutes);
app.use("/cap-table", capTableRoutes);
app.use("/factory", factoryRoutes);
app.use("/issuer", issuerRoutes);
app.use("/stakeholder", contractMiddleware, stakeholderRoutes);
app.use("/stock-class", contractMiddleware, stockClassRoutes);
// No middleware required since these are only created offchain
app.use("/stock-legend", stockLegendRoutes);
app.use("/stock-plan", stockPlanRoutes);
app.use("/valuation", valuationRoutes);
app.use("/vesting-terms", vestingTermsRoutes);
app.use("/historical-transactions", historicalTransactions);
app.use("/dashboard", dashboard);
app.use("/export", exportRoutes);

// transactions
app.use("/transactions/", contractMiddleware, transactionRoutes);

export const startServer = async (finalizedOnly) => {
    /*
    processTo can be "latest" or "finalized". Latest helps during testing bc we dont have to wait for blocks to finalize
    */

    // Connect to MongoDB
    const dbConn = await connectDB();

    const server = app
        .listen(PORT, async () => {
            console.log(`🚀  Server successfully launched at ${PORT}`);
            // Asynchronous job to track web3 events in web2
            startEventProcessing(finalizedOnly, dbConn);
        })
        .on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.log(`Port ${PORT} is already in use.`);
            } else {
                console.log(err);
            }
        });

    server.on("listening", () => {
        const address = server.address();
        const bind = typeof address === "string" ? "pipe " + address : "port " + address.port;
        console.log("Listening on " + bind);
    });

    return server;
};

export const shutdownServer = async (server) => {
    if (server) {
        console.log("Shutting down app server...");
        server.close();
    }

    console.log("Waiting for event processing to stop...");
    await stopEventProcessing();

    if (mongoose.connection?.readyState === mongoose.STATES.connected) {
        console.log("Disconnecting from mongo...");
        await mongoose.disconnect();
    }
};
