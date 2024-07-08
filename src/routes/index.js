import { Router } from "express";
import deployCapTable from "../chain-operations/deployCapTable.js";
import { updateIssuerById } from "../db/operations/update.js";
import seedDB, { verifyManifest } from "../db/scripts/seed.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import processManifest from "../utils/processManifest.js";

const router = Router();

router.get("/", async (req, res) => {
    console.log("Welcome to the future of Captables, old man 🧠 -");
    res.status(200).send(`Welcome to the future of Transfer Agents 💸`);
});

router.post("/mint-cap-table", async (req, res) => {
    try {
        const manifest = await processManifest(req);

        const issuer = await seedDB(manifest);

        const issuerIdBytes16 = convertUUIDToBytes16(issuer._id);
        const { contract, address, provider, libraries } = await deployCapTable(issuerIdBytes16, issuer.legal_name, issuer.initial_shares_authorized);

        const savedIssuerWithDeployedTo = await updateIssuerById(issuer._id, { deployed_to: address });
        res.status(200).send({ issuer: savedIssuerWithDeployedTo });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error });
    }
});

router.post("/verify-cap-table", async (req, res) => {
    try {
        const manifest = await processManifest(req);
        await verifyManifest(manifest);
        res.status(200).send({ valid: true });
    } catch (error) {
        console.error({ error });
        res.status(500).send({ error: String(error), valid: false });
    }
});

export default router;
