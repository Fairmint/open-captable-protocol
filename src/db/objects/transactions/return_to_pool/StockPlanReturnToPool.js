import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

const StockPlanReturnToPoolSchema = new mongoose.Schema({
    id: { type: String, default: () => uuid() },
    object_type: { type: String, default: "TX_STOCK_PLAN_RETURN_TO_POOL" },
    comments: [String],
    security_id: String,
    date: String,
    reason_text: String,
    quantity: String,
    stock_plan_id: String,
});

const StockPlanReturnToPool = mongoose.model("StockPlanReturnToPool", StockPlanReturnToPoolSchema);

export default StockPlanReturnToPool;
