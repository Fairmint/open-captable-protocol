import { connectDB } from "./src/db/config/mongoose.js";
// import { getAllStateMachineObjectsById } from "./src/db/operations/read.js";
// import fs from "fs/promises";
// import { captableStats } from "./src/rxjs/index.js";
import { AbiCoder } from "ethers";
import getProvider from "./src/chain-operations/getProvider.js";
import sleep from "./src/utils/sleep.js";
// import { handleStakeholder } from "./src/chain-operations/transactionHandlers.js";

import { API_URL } from "./src/fairmint/config.js";
import { handleStakeholder } from "./src/chain-operations/transactionHandlers.js";
console.log(API_URL);

async function main() {
    await connectDB();

    // const provider = new ethers.JsonRpcProvider(process.env.RPC_URL?.replace("ws", "http"));
    const provider = getProvider();

    const startBlock = 17520474;
    const endBlock = 17520513;
    const contractAddress = "0xa5Efe75D0d91C2eB8864B15f6F3DBA9fb46B8b66";

    try {
        // Get logs for the contract address between blocks
        const logs = await provider.getLogs({
            address: contractAddress,
            fromBlock: startBlock,
            toBlock: endBlock,
            topics: [
                // Filter for StakeholderCreated events
                "0x53df47344d1cdf2ddb4901af5df61e37e14606bb7c8cc004d65c7c83ab3d0693",
            ],
        });

        console.log(`Found ${logs.length} StakeholderCreated events`);

        const abiCoder = new AbiCoder();
        // Process each log
        for (const log of logs) {
            const [stakeholderIdBytes16] = abiCoder.decode(["bytes16"], log.topics[1]);

            console.log("Processing stakeholder:", stakeholderIdBytes16);
            await handleStakeholder(stakeholderIdBytes16);
            await sleep(3000);
            console.log("waiting for 3 seconds");
        }
    } catch (error) {
        console.error("Error querying logs:", error);
    }
    // const data = await captableStats();
    // console.log(JSON.stringify(data, null, 2));
    // const data = await getAllStateMachineObjectsById("d8b01157-d204-4960-b56b-5fcd3db3741b");
    // await fs.writeFile("./scap5-data.json", JSON.stringify(data, null, 2));
    // console.log("Data written to data.json");
}

main();
