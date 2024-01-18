import { config } from "dotenv";
import { ethers } from "ethers";
import CAP_TABLE from "../../chain/out/CapTable.sol/CapTable.json" assert { type: "json" };
import CAP_TABLE_FACTORY from "../../chain/out/CapTableFactory.sol/CapTableFactory.json" assert { type: "json" };
import { readFactory } from "../db/operations/read.js";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import getTXLibContracts from "../utils/getLibrariesContracts.js";
import getProvider from "./getProvider.js";

config();

async function deployCapTable(issuerId, issuerName, initial_shares_authorized) {
    const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;

    const provider = getProvider();

    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);

    console.log("🗽 | Wallet address: ", wallet.address);

    const factory = await readFactory();
    const factoryAddress = factory[0].factory_address;

    console.log("factory ", factory);

    if (!factoryAddress) {
        throw new Error(`❌ | Factory address not found`);
    }

    const capTableFactory = new ethers.Contract(factoryAddress, CAP_TABLE_FACTORY.abi, wallet);

    const tx = await capTableFactory.createCapTable(issuerId, issuerName, toScaledBigNumber(initial_shares_authorized));
    await tx.wait();

    const capTableCount = await capTableFactory.getCapTableCount();

    console.log("📄 | Cap table count: ", capTableCount);

    const latestCapTableProxyContractAddress = await capTableFactory.capTableProxies(capTableCount - BigInt(1));

    const contract = new ethers.Contract(latestCapTableProxyContractAddress, CAP_TABLE.abi, wallet);

    console.log("⏳ | Waiting for contract to be deployed...");
    console.log("✅ | Cap table contract address ", latestCapTableProxyContractAddress);
    const libraries = getTXLibContracts(latestCapTableProxyContractAddress, wallet);

    return {
        contract,
        provider,
        address: latestCapTableProxyContractAddress,
        libraries,
    };
}

export default deployCapTable;
