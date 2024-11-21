import { convertBytes16ToUUID } from "../utils/convertUUID.js";
import { createHistoricalTransaction } from "../db/operations/create.js";
import { readFairmintDataBySecurityId } from "../db/operations/read.js";
import {
    updateStakeholderById,
    updateStockClassById,
    upsertStockTransferById,
    upsertStockCancellationById,
    upsertStockRetractionById,
    upsertStockReissuanceById,
    upsertStockRepurchaseById,
    upsertStockAcceptanceById,
    upsertStockClassAuthorizedSharesAdjustment,
    upsertIssuerAuthorizedSharesAdjustment,
    updateStockPlanById,
    updateStockIssuanceBySecurityId,
} from "../db/operations/update.js";
import get from "lodash/get";
import { reflectSeries } from "../fairmint/reflectSeries.js";
import { toDecimal } from "../utils/convertToFixedPointDecimals.js";
import { SERIES_TYPE } from "../fairmint/enums.js";
import { reflectStakeholder } from "../fairmint/reflectStakeholder.js";
import { reflectInvestment } from "../fairmint/reflectInvestment.js";
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

const isUUID = (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
};

const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
};

export const handleStockIssuance = async (stock, issuerId, timestamp) => {
    console.log("StockIssuanceCreated Event Emitted!", stock);
    const { security_id } = stock;

    let series_id = null;
    let historicalDate = null;

    // if (comments && comments.length > 0) {
    //     comments.forEach((comment) => {
    //         if (comment.includes("fairmintData")) {
    //             const [key, value] = comment.split("=");
    //             if (key === "fairmintData") {
    //                 const fairmintData = JSON.parse(value);
    //                 series_id = fairmintData.series_id;
    //                 historicalDate = fairmintData.date;
    //             }
    //         }
    //     });
    // }

    // Update: get fairmint data by securityId
    const fairmintData = await readFairmintDataBySecurityId(security_id);

    // Type represention of an ISO-8601 date, e.g. 2022-01-28.
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];

    const _security_id = convertBytes16ToUUID(security_id);

    const createdStockIssuance = await updateStockIssuanceBySecurityId(_security_id, {
        date: historicalDate ? historicalDate : chainDate, // priortise historical date if available
        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdStockIssuance._id,
        issuer: issuerId,
        transactionType: "StockIssuance",
    });

    const dollarAmount = Number(get(createdStockIssuance, "share_price.amount")) * Number(get(createdStockIssuance, "quantity")); // do we need to store this dollarAmount on Fairmint

    if (isUUID(series_id) && fairmintData && fairmintData._id) {
        // First, create series (or verify it's created)
        const seriesCreatedResp = await reflectSeries({
            issuerId,
            series_id,
            stock_class_id: get(createdStockIssuance, "stock_class_id", null),
            stock_plan_id: get(createdStockIssuance, "stock_plan_id", null),
            series_name: get(fairmintData, "attributes.series_name"),
            series_type: SERIES_TYPE.SHARES,
            price_per_share: get(createdStockIssuance, "share_price.amount", null),
            date: get(createdStockIssuance, "date"),
        });

        console.log("series created response ", seriesCreatedResp);

        const reflectedInvestmentResp = await reflectInvestment({
            security_id: _security_id,
            issuerId,
            stakeholder_id: stakeholder._id,
            series_id,
            amount: dollarAmount,
            number_of_shares: get(createdStockIssuance, "quantity").toString(),
            date: get(createdStockIssuance, "date"),
        });

        console.log("stock investment response:", reflectedInvestmentResp);
    }

    console.log(
        `✅ | StockIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockIssuance
    );
};

export const handleStockTransfer = async (stock, issuerId) => {
    console.log(`Stock Transfer with quantity ${toDecimal(stock.quantity).toString()} received at `, new Date(Date.now()).toLocaleDateString());

    const id = convertBytes16ToUUID(stock.id);
    const quantity = toDecimal(stock.quantity).toString();
    const createdStockTransfer = await upsertStockTransferById(id, {
        _id: id,
        object_type: stock.object_type,
        quantity,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        consideration_text: stock.consideration_text,
        balance_security_id: convertBytes16ToUUID(stock.balance_security_id),
        resulting_security_ids: convertBytes16ToUUID(stock.resulting_security_ids),
        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log("Stock Transfer reflected and validated off-chain", createdStockTransfer);

    await createHistoricalTransaction({
        transaction: createdStockTransfer._id,
        issuer: createdStockTransfer.issuer,
        transactionType: "StockTransfer",
    });

    console.log(
        `✅ | StockTransfer confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockTransfer
    );
};

export const handleStakeholder = async (id) => {
    try {
        console.log("StakeholderCreated Event Emitted!", id);
        const incomingStakeholderId = convertBytes16ToUUID(id);
        const stakeholder = await updateStakeholderById(incomingStakeholderId, { is_onchain_synced: true });

        if (!stakeholder) {
            throw Error("handleStakeholder: Stakeholder does not exist throw Error ");
        }

        // TODO: condtionally reflect stakeholder to fairmint
        await reflectStakeholder({ stakeholder, issuerId: stakeholder.issuer });
    } catch (error) {
        throw Error("Error handing Stakeholder On Chain", error);
    }
};

export const handleStockClass = async (id) => {
    console.log("StockClassCreated Event Emitted!", id);
    const incomingStockClassId = convertBytes16ToUUID(id);
    const stockClass = await updateStockClassById(incomingStockClassId, { is_onchain_synced: true });
    console.log("✅ | StockClass confirmation onchain ", stockClass);
};

export const handleStockCancellation = async (stock, issuerId, timestamp) => {
    console.log("StockCancellationCreated Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const createdStockCancellation = await upsertStockCancellationById(id, {
        _id: id,
        object_type: stock.object_type,
        quantity: toDecimal(stock.quantity).toString(),
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        reason_text: stock.reason_text,
        balance_security_id: convertBytes16ToUUID(stock.balance_security_id),
        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdStockCancellation._id,
        issuer: createdStockCancellation.issuer,
        transactionType: "StockCancellation",
    });
    console.log(
        `✅ | StockCancellation confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockCancellation
    );
};

export const handleStockRetraction = async (stock, issuerId, timestamp) => {
    console.log("StockRetractionCreated Event Emitted!", stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const id = convertBytes16ToUUID(stock.id);
    const createdStockRetraction = await upsertStockRetractionById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        reason_text: stock.reason_text,
        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdStockRetraction._id,
        issuer: createdStockRetraction.issuer,
        transactionType: "StockRetraction",
    });
    console.log(
        `✅ | StockRetraction confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockRetraction
    );
};

export const handleStockReissuance = async (stock, issuerId, timestamp) => {
    console.log("StockReissuanceCreated Event Emitted!", stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const id = convertBytes16ToUUID(stock.id);
    const createdStockReissuance = await upsertStockReissuanceById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        reason_text: stock.reason_text,
        resulting_security_ids: stock.resulting_security_ids.map((sId) => convertBytes16ToUUID(sId)),
        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdStockReissuance._id,
        issuer: createdStockReissuance.issuer,
        transactionType: "StockReissuance",
    });
    console.log(
        `✅ | StockReissuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockReissuance
    );
};

export const handleStockRepurchase = async (stock, issuerId, timestamp) => {
    console.log("StockRepurchaseCreated Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);

    const sharePriceOCF = {
        amount: toDecimal(stock.price).toString(),
        currency: "USD",
    };

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const createdStockRepurchase = await upsertStockRepurchaseById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        price: sharePriceOCF,
        quantity: toDecimal(stock.quantity).toString(),
        consideration_text: stock.consideration_text,
        balance_security_id: convertBytes16ToUUID(stock.balance_security_id),

        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdStockRepurchase._id,
        issuer: createdStockRepurchase.issuer,
        transactionType: "StockRepurchase",
    });
    console.log(
        `✅ | StockRepurchase confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockRepurchase
    );
};

export const handleStockAcceptance = async (stock, issuerId, timestamp) => {
    console.log("StockAcceptanceCreated Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const createdStockAcceptance = await upsertStockAcceptanceById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,

        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdStockAcceptance._id,
        issuer: createdStockAcceptance.issuer,
        transactionType: "StockAcceptance",
    });
    console.log(
        `✅ | StockAcceptance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockAcceptance
    );
};

export const handleStockClassAuthorizedSharesAdjusted = async (stock, issuerId, timestamp) => {
    console.log("StockClassAuthorizedSharesAdjusted Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);
    console.log("stock price", stock.price);

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const upsert = await upsertStockClassAuthorizedSharesAdjustment(id, {
        _id: id,
        stock_class_id: convertBytes16ToUUID(stock.stock_class_id),
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        new_shares_authorized: toDecimal(stock.new_shares_authorized).toString(),
        board_approval_date: stock.board_approval_date,
        stockholder_approval_date: stock.stockholder_approval_date,

        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: upsert._id,
        issuer: issuerId,
        transactionType: "StockClassAuthorizedSharesAdjustment",
    });
    console.log(
        `✅ | StockClassAuthorizedSharesAdjusted confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        upsert
    );
};

export const handleIssuerAuthorizedSharesAdjusted = async (issuer, issuerId, timestamp) => {
    console.log("IssuerAuthorizedSharesAdjusted Event Emitted!", issuer.id);
    const id = convertBytes16ToUUID(issuer.id);
    console.log("stock price", issuer.price);

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const upsert = await upsertIssuerAuthorizedSharesAdjustment(id, {
        _id: id,
        object_type: issuer.object_type,
        comments: issuer.comments,
        issuer_id: convertBytes16ToUUID(issuer.security_id),
        date: dateOCF,
        new_shares_authorized: toDecimal(issuer.new_shares_authorized).toString(),
        board_approval_date: issuer.board_approval_date,
        stockholder_approval_date: issuer.stockholder_approval_date,

        // TAP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: upsert._id,
        issuer: issuerId,
        transactionType: "IssuerAuthorizedSharesAdjustment",
    });
    console.log(
        `✅ | IssuerAuthorizedSharesAdjusted confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        upsert
    );
};

export const handleStockPlan = async (id) => {
    console.log("StockPlanCreated Event Emitted!", id);
    const incomingStockPlanId = convertBytes16ToUUID(id);
    const stockPlan = await updateStockPlanById(incomingStockPlanId, { is_onchain_synced: true });
    console.log("✅ | StockPlan confirmation onchain ", stockPlan);
};

export const contractFuncs = new Map([
    ["StakeholderCreated", handleStakeholder],
    ["StockClassCreated", handleStockClass],
    ["StockPlanCreated", handleStockPlan],
]);

export const txMapper = {
    1: [IssuerAuthorizedSharesAdjustment, handleIssuerAuthorizedSharesAdjusted],
    2: [StockClassAuthorizedSharesAdjustment, handleStockClassAuthorizedSharesAdjusted],
    3: [StockAcceptance, handleStockAcceptance],
    4: [StockCancellation, handleStockCancellation],
    5: [StockIssuance, handleStockIssuance],
    6: [StockReissuance, handleStockReissuance],
    7: [StockRepurchase, handleStockRepurchase],
    8: [StockRetraction, handleStockRetraction],
    9: [StockTransfer, handleStockTransfer],
};
// (idx => type name) derived from txMapper
export const txTypes = Object.fromEntries(
    // @ts-ignore
    Object.entries(txMapper).map(([i, [_, f]]) => [i, f.name.replace("handle", "")])
);
// (name => handler) derived from txMapper
export const txFuncs = Object.fromEntries(Object.entries(txMapper).map(([i, [_, f]]) => [txTypes[i], f]));
