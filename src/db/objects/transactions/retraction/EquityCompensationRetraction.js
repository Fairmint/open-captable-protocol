import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

const EquityCompensationRetractionType = ["TX_PLAN_SECURITY_RETRACTION", "TX_EQUITY_COMPENSATION_RETRACTION"];

const EquityCompensationRetractionSchema = new mongoose.Schema({
    id: { type: String, default: () => uuid() },
    object_type: { type: String, enum: EquityCompensationRetractionType }, // You may want to define this type
    comments: [String],
    security_id: String,
    date: String,
    reason_text: String,
});

const EquityCompensationRetraction = mongoose.model("EquityCompensationRetraction", EquityCompensationRetractionSchema);

export default EquityCompensationRetraction;
