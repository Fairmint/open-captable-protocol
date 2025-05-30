import issuerSchema from "../../../ocf/schema/objects/Issuer.schema.json";
import stakeholderSchema from "../../../ocf/schema/objects/Stakeholder.schema.json";
import stockClassSchema from "../../../ocf/schema/objects/StockClass.schema.json";
import stockLegendTemplateSchema from "../../../ocf/schema/objects/StockLegendTemplate.schema.json";
import stockPlanSchema from "../../../ocf/schema/objects/StockPlan.schema.json";
import valuationSchema from "../../../ocf/schema/objects/Valuation.schema.json";
import vestingTermsSchema from "../../../ocf/schema/objects/VestingTerms.schema.json";
import get from "lodash/get.js";
import {
    createIssuer,
    createStakeholder,
    createStockClass,
    createStockLegendTemplate,
    createStockPlan,
    createValuation,
    createVestingTerms,
} from "../operations/create.js";
import addTransactions from "../operations/transactions.js";

import txStockIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/StockIssuance.schema.json";
import txStockCancellationSchema from "../../../ocf/schema/objects/transactions/cancellation/StockCancellation.schema.json";
import txStockTransferSchema from "../../../ocf/schema/objects/transactions/transfer/StockTransfer.schema.json";
import txStockRetractionSchema from "../../../ocf/schema/objects/transactions/retraction/StockRetraction.schema.json";
import txStockAcceptanceSchema from "../../../ocf/schema/objects/transactions/acceptance/StockAcceptance.schema.json";
import txStockReissuanceSchema from "../../../ocf/schema/objects/transactions/reissuance/StockReissuance.schema.json";
import txStockRepurchaseSchema from "../../../ocf/schema/objects/transactions/repurchase/StockRepurchase.schema.json";
import txStockClassAuthorizedSharesAdjustmentSchema from "../../../ocf/schema/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json";
import txConvertibleIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/ConvertibleIssuance.schema.json";
import txEquityCompensationIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json";
import txWarrantIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/WarrantIssuance.schema.json";
import txIssuerAuthorizedSharesAdjustmentSchema from "../../../ocf/schema/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json";
import txStockPlanPoolAdjustmentSchema from "../../../ocf/schema/objects/transactions/adjustment/StockPlanPoolAdjustment.schema.json";
import txEquityCompensationExerciseSchema from "../../../ocf/schema/objects/transactions/exercise/EquityCompensationExercise.schema.json";
import validateInputAgainstOCF from "../../utils/validateInputAgainstSchema.js";

async function processEntity(inputEntities, createEntityFunction, schema, issuerId) {
    for (let inputEntity of inputEntities.items) {
        await validateInputAgainstOCF(inputEntity, schema);
        inputEntity = { ...inputEntity, issuer: issuerId };
        await createEntityFunction(inputEntity);
    }
}

async function validateEntity(inputEntities, schema) {
    if (!inputEntities) return;
    for (let inputEntity of inputEntities.items) {
        await validateInputAgainstOCF(inputEntity, schema);
    }
}

export async function processTransactionEntity(txs) {
    for (let tx of txs.items) {
        let schema;
        switch (tx.object_type) {
            case "TX_STOCK_ISSUANCE":
                schema = txStockIssuanceSchema;
                break;
            case "TX_STOCK_TRANSFER":
                schema = txStockTransferSchema;
                break;
            case "TX_STOCK_CANCELLATION":
                schema = txStockCancellationSchema;
                break;
            case "TX_STOCK_RETRACTION":
                schema = txStockRetractionSchema;
                break;
            case "TX_STOCK_REISSUANCE":
                schema = txStockReissuanceSchema;
                break;
            case "TX_STOCK_ACCEPTANCE":
                schema = txStockAcceptanceSchema;
                break;
            case "TX_STOCK_REPURCHASE":
                schema = txStockRepurchaseSchema;
                break;
            case "TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT":
                schema = txStockClassAuthorizedSharesAdjustmentSchema;
                break;
            case "TX_CONVERTIBLE_ISSUANCE":
                schema = txConvertibleIssuanceSchema;
                break;
            case "TX_EQUITY_COMPENSATION_ISSUANCE":
                schema = txEquityCompensationIssuanceSchema;
                break;
            case "TX_WARRANT_ISSUANCE":
                schema = txWarrantIssuanceSchema;
                break;
            case "TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT":
                schema = txIssuerAuthorizedSharesAdjustmentSchema;
                break;
            case "TX_STOCK_PLAN_POOL_ADJUSTMENT":
                schema = txStockPlanPoolAdjustmentSchema;
                break;
            case "TX_EQUITY_COMPENSATION_EXERCISE":
                schema = txEquityCompensationExerciseSchema;
                break;
            default:
                throw new Error(`${tx.object_type} is not mapped - please add the transaction validation to the schema`);
        }

        if (tx?.series_id) {
            delete tx.series_id;
        }
        if (tx?.series_name) {
            delete tx.series_name;
        }

        await validateInputAgainstOCF(tx, schema);
    }
}

// 1. process issuer, save to DB
// 2. process other files, save to DB
// 3. process transactions, save to DB
// 4. mint cap table
// 5. on IssuerCreated event, create the stakeholders, stock classes, etc onchain
// 6. on IssuerCreated event, mint transactions with DB data. Save again on those events

export async function verifyManifest(manifestArr) {
    let incomingIssuer;
    let incomingStakeholders;
    let incomingStockClasses;
    let incomingStockLegendTemplates;
    let incomingStockPlans;
    let incomingValuations;
    let incomingVestingTerms;
    let incomingTransactions;

    manifestArr.forEach((file) => {
        if (file.issuer) incomingIssuer = file.issuer;
        if (file.file_type === "OCF_STAKEHOLDERS_FILE") incomingStakeholders = file;
        if (file.file_type === "OCF_STOCK_CLASSES_FILE") incomingStockClasses = file;
        if (file.file_type === "OCF_STOCK_LEGEND_TEMPLATES_FILE") incomingStockLegendTemplates = file;
        if (file.file_type === "OCF_STOCK_PLANS_FILE") incomingStockPlans = file;
        if (file.file_type === "OCF_VALUATIONS_FILE") incomingValuations = file;
        if (file.file_type === "OCF_VESTING_TERMS_FILE") incomingVestingTerms = file;
        if (file.file_type === "OCF_TRANSACTIONS_FILE") incomingTransactions = file;
    });

    await validateInputAgainstOCF(incomingIssuer, issuerSchema);
    await validateEntity(incomingStakeholders, stakeholderSchema);
    await validateEntity(incomingStockClasses, stockClassSchema);
    await validateEntity(incomingStockLegendTemplates, stockLegendTemplateSchema);
    await validateEntity(incomingStockPlans, stockPlanSchema);
    await validateEntity(incomingValuations, valuationSchema);
    await validateEntity(incomingVestingTerms, vestingTermsSchema);
    await processTransactionEntity(incomingTransactions);
    return {
        issuer: incomingIssuer,
        stakeholders: get(incomingStakeholders, "items", []),
        stockClasses: get(incomingStockClasses, "items", []),
        stockPlans: get(incomingStockPlans, "items", []),
        valuations: get(incomingValuations, "items", []),
        vestingTerms: get(incomingVestingTerms, "items", []),
        transactions: get(incomingTransactions, "items", []),
    };
}

async function seedDB(manifestArr) {
    let incomingIssuer;
    let incomingStakeholders;
    let incomingStockClasses;
    let incomingStockLegendTemplates;
    let incomingStockPlans;
    let incomingValuations;
    let incomingVestingTerms;
    let incomingTransactions;

    manifestArr.forEach((file) => {
        if (file.issuer) incomingIssuer = file.issuer;
        if (file.file_type === "OCF_STAKEHOLDERS_FILE") incomingStakeholders = file;
        if (file.file_type === "OCF_STOCK_CLASSES_FILE") incomingStockClasses = file;
        if (file.file_type === "OCF_STOCK_LEGEND_TEMPLATES_FILE") incomingStockLegendTemplates = file;
        if (file.file_type === "OCF_STOCK_PLANS_FILE") incomingStockPlans = file;
        if (file.file_type === "OCF_VALUATIONS_FILE") incomingValuations = file;
        if (file.file_type === "OCF_VESTING_TERMS_FILE") incomingVestingTerms = file;
        if (file.file_type === "OCF_TRANSACTIONS_FILE") incomingTransactions = file;
    });

    await validateInputAgainstOCF(incomingIssuer, issuerSchema);

    const issuerWithFlag = { is_manifest_created: true, ...incomingIssuer };
    const issuer = await createIssuer(issuerWithFlag);

    const issuerId = issuer._id;

    await processEntity(incomingStakeholders, createStakeholder, stakeholderSchema, issuerId);
    await processEntity(incomingStockClasses, createStockClass, stockClassSchema, issuerId);
    await processEntity(incomingStockLegendTemplates, createStockLegendTemplate, stockLegendTemplateSchema, issuerId);
    await processEntity(incomingStockPlans, createStockPlan, stockPlanSchema, issuerId);
    await processEntity(incomingValuations, createValuation, valuationSchema, issuerId);
    await processEntity(incomingVestingTerms, createVestingTerms, vestingTermsSchema, issuerId);
    await processTransactionEntity(incomingTransactions);

    await addTransactions(incomingTransactions, issuerId);

    return issuer;
}

export default seedDB;
