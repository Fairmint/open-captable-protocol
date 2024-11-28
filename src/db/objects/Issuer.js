import mongoose from "mongoose";
import { v4 as uuid } from 'uuid';
const Schema = mongoose.Schema;

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
    tx_hash: String,
    last_processed_block: { type: Number, default: null },
    is_manifest_created: { type: Boolean, default: false },
    chain: {
      type: String,
      enum: ['BASE', 'SEPOLIA', 'ANVIL'],
    },
  },
  { timestamps: true }
);

// Helper function to get chain ID from chain name
IssuerSchema.methods.getChainId = function () {
  const chainMap = {
    'BASE': 8453,
    'SEPOLIA': 84532,
    'ANVIL': 31337
  };
  return chainMap[this.chain];
};

// Method to get explorer URL for deployment transaction
IssuerSchema.methods.getExplorerUrl = function () {
  const chainMap = {
    'BASE': 'https://basescan.org',
    'SEPOLIA': 'https://sepolia.basescan.org',
    'ANVIL': 'http://localhost:8545'
  };
  return `${chainMap[this.chain]}/address/${this.deployed_to}`;
};

const Issuer = mongoose.model("Issuer", IssuerSchema);
export default Issuer;