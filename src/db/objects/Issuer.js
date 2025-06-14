import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

// * PRIMARY OBJECTS: Links to validation schemas live under ocf repo schema/objects
const IssuerSchema = new mongoose.Schema(
    {
        _id: { type: String, default: () => uuid() },
        object_type: { type: String, default: "ISSUER" },
        legal_name: String,
        dba: String,
        formation_date: String,
        country_of_formation: String,
        country_subdivision_of_formation: String,
        tax_ids: [{}],
        email: {},
        phone: {},
        address: {},
        initial_shares_authorized: String,
        comments: [String],
        deployed_to: String, // Address of its CapTable
        last_processed_block: { type: Number, default: null },
        is_manifest_created: { type: Boolean, default: false },
        chain_id: { type: Number, required: true },
        tx_hash: { type: String, default: null },
        factory: { ref: "Factory", type: String },
        party_id: { type: String, default: null },
    },
    { timestamps: true }
);

const Issuer = mongoose.model("Issuer", IssuerSchema);

export default Issuer;
