import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

const StockClassAuthorizedSharesAdjustmentSchema = new mongoose.Schema(
    {
        _id: { type: String, default: () => uuid() },
        object_type: { type: String, default: "TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT" },
        comments: [String],
        date: String,
        stock_class_id: String,
        new_shares_authorized: String,
        board_approval_date: String,
        stockholder_approval_date: String,
        is_onchain_synced: { type: Boolean, default: false },
        issuer: {
            type: String,
            ref: "Issuer",
        },
        tx_hash: { type: String, default: null },
    },
    { timestamps: true }
);

const StockClassAuthorizedSharesAdjustment = mongoose.model("StockClassAuthorizedSharesAdjustment", StockClassAuthorizedSharesAdjustmentSchema);

export default StockClassAuthorizedSharesAdjustment;
