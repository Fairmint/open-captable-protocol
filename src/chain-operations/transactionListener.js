import { verifyIssuerAndSeed } from "./seed.js";
import {
    handleStockCancellation,
    handleIssuerAuthorizedSharesAdjusted,
    handleStockAcceptance,
    handleStockReissuance,
    handleStockRepurchase,
    handleStockRetraction,
    handleStockClass,
    handleStakeholder,
    handleStockIssuance,
    handleStockTransfer,
    handleStockClassAuthorizedSharesAdjusted,
} from "./transactionHandlers.js";
import { AbiCoder } from "ethers";
import {
    IssuerAuthorizedSharesAdjustment,
    StockAcceptance,
    StockCancellation,
    StockClassAuthorizedSharesAdjustment,
    StockIssuance,
    StockReissuance,
    StockRepurchase,
    StockRetraction,
    StockTransfer,
} from "./structs.js";
import { readFairmintDataById } from "../db/operations/read.js";
import { API_URL } from "../fairmint/config.js";
import axios from "axios";
import get from "lodash/get.js";

const abiCoder = new AbiCoder();

const txMapper = {
    0: ["INVALID"],
    1: ["ISSUER_AUTHORIZED_SHARES_ADJUSTMENT", IssuerAuthorizedSharesAdjustment],
    2: ["STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT", StockClassAuthorizedSharesAdjustment],
    3: ["STOCK_ACCEPTANCE", StockAcceptance],
    4: ["STOCK_CANCELLATION", StockCancellation],
    5: ["STOCK_ISSUANCE", StockIssuance],
    6: ["STOCK_REISSUANCE", StockReissuance],
    7: ["STOCK_REPURCHASE", StockRepurchase],
    8: ["STOCK_RETRACTION", StockRetraction],
    9: ["STOCK_TRANSFER", StockTransfer],
};

const contractQueues = new Map();

async function startOnchainListeners(contract, provider, issuerId, libraries) {
    if (!contractQueues.has(issuerId)) {
        contractQueues.set(issuerId, []);
    }
    let isProcessing = false;
    let issuerEventReceived = false;

    console.log("🌐 | Initiating on-chain event listeners for issuer", issuerId, "at address", contract.target);

    const processEventQueue = async () => {
        if (isProcessing) return;
        const eventQueue = contractQueues.get(issuerId);
        eventQueue.sort((a, b) => a.timestamp - b.timestamp);
        let event;
        try {
            while (eventQueue.length > 0) {
                event = eventQueue[0]; // Peek the queue
                await processEvent(event);
                eventQueue.shift(); // Pop the queue after processing
            }
        } catch (error) {
            console.error(`Error processing event of type ${get(event, "type", event)}:`, error);
        } finally {
            isProcessing = false;
        }
    };

    const queueAndProcessEvent = async (event) => {
        const eventQueue = contractQueues.get(issuerId);
        eventQueue.push(event);
        await processEventQueue();
    };

    libraries.txHelper.on("TxCreated", async (_, txTypeIdx, txData, event) => {
        const [type, structType] = txMapper[txTypeIdx];
        const decodedData = abiCoder.decode([structType], txData);
        const { timestamp } = await provider.getBlock(event.blockNumber);
        await queueAndProcessEvent({ type, data: decodedData[0], issuerId, timestamp });
    });

    contract.on("StakeholderCreated", async (id) => {
        console.log("Create Stakeholder event");
        await queueAndProcessEvent({ type: "STAKEHOLDER_CREATED", data: id, issuerId });
    });

    contract.on("StockClassCreated", async (id) => {
        await queueAndProcessEvent({ type: "STOCK_CLASS_CREATED", data: id, issuerId });
    });

    // Issuer Initialization: This is the first time we're processing the issuer.
    const issuerCreatedFilter = contract.filters.IssuerCreated;
    const issuerEvents = await contract.queryFilter(issuerCreatedFilter);

    if (issuerEvents.length > 0 && !issuerEventReceived) {
        const id = issuerEvents[0].args[0];
        console.log("IssuerCreated Event Emitted!", id);
        console.log("New issuer was deployed", { issuerId: id });

        const fairmintData = await readFairmintDataById(issuerId);
        if (fairmintData !== null && fairmintData._id) {
            console.log("Fairmint data", fairmintData._id);
            console.log("Reflecting Issuer into fairmint...");
            const webHookUrl = `${API_URL}/ocp/reflectCaptable?portalId=${issuerId}`;
            const resp = await axios.post(webHookUrl, {});
            console.log(`Successfully reflected Issuer ${issuerId} into Fairmint webhook`);
            console.log("Fairmint response:", resp.data);
        }

        await verifyIssuerAndSeed(contract, id);
        issuerEventReceived = true;
    }
}

async function processEvent(event) {
    if (!event) {
        console.error("WARN:processEvent: Event inside is undefined");
        return;
    }
    switch (event.type) {
        case "STAKEHOLDER_CREATED":
            await handleStakeholder(event.data);
            break;
        case "STOCK_CLASS_CREATED":
            await handleStockClass(event.data);
            break;
        case "ISSUER_AUTHORIZED_SHARES_ADJUSTMENT":
            await handleIssuerAuthorizedSharesAdjusted(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT":
            await handleStockClassAuthorizedSharesAdjusted(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_ACCEPTANCE":
            await handleStockAcceptance(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_CANCELLATION":
            await handleStockCancellation(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_ISSUANCE":
            await handleStockIssuance(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_REISSUANCE":
            await handleStockReissuance(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_REPURCHASE":
            await handleStockRepurchase(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_RETRACTION":
            await handleStockRetraction(event.data, event.issuerId, event.timestamp);
            break;
        case "STOCK_TRANSFER":
            await handleStockTransfer(event.data, event.issuerId, event.timestamp);
            break;
        case "INVALID":
            throw new Error("Invalid transaction type");
        default:
            console.warn(`Unhandled event type: ${get(event, "type")}`);
    }
}

export default startOnchainListeners;
