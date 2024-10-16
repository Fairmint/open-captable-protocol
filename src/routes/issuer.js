import { Router } from "express";
import { v4 as uuid } from "uuid";

import issuerSchema from "../../ocf/schema/objects/Issuer.schema.json" assert { type: "json" };
import deployCapTable from "../chain-operations/deployCapTable.js";
import { createFairmintData, createIssuer } from "../db/operations/create.js";
import { countIssuers, readIssuerById } from "../db/operations/read.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import validateInputAgainstOCF from "../utils/validateInputAgainstSchema.js";
import { checkPortal } from "../fairmint/checkPortal.js";
import { addAddressesToWatch } from "../utils/websocket.js";
const issuer = Router();

issuer.get("/", async (req, res) => {
    res.send(`Hello issuer!`);
});

//WIP get routes are currently fetching offchain.
issuer.get("/id/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const { issuerId, type, role } = await readIssuerById(id);

        res.status(200).send({ issuerId, type, role });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

issuer.get("/total-number", async (req, res) => {
    try {
        const totalIssuers = await countIssuers();
        res.status(200).send(totalIssuers);
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

issuer.post("/create", async (req, res) => {
    try {
        // OCF doesn't allow extra fields in their validation
        const incomingIssuerToValidate = {
            id: uuid(),
            object_type: "ISSUER",
            ...req.body,
        };

        console.log("⏳ | Issuer to validate", incomingIssuerToValidate);

        await validateInputAgainstOCF(incomingIssuerToValidate, issuerSchema);
        const exists = await readIssuerById(incomingIssuerToValidate.id);
        if (exists && exists._id) {
            return res.status(200).send({ message: "issuer already exists", issuer: exists });
        }
        const issuerIdBytes16 = convertUUIDToBytes16(incomingIssuerToValidate.id);
        console.log("💾 | Issuer id in bytes16 ", issuerIdBytes16);
        const { address, deployHash } = await deployCapTable(issuerIdBytes16, incomingIssuerToValidate.initial_shares_authorized);

        const incomingIssuerForDB = {
            ...incomingIssuerToValidate,
            deployed_to: address,
            tx_hash: deployHash,
        };

        const issuer = await createIssuer(incomingIssuerForDB);
        addAddressesToWatch(address);

        console.log("✅ | Issuer created offchain:", issuer);

        res.status(200).send({ issuer });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

issuer.post("/create-fairmint-reflection", async (req, res) => {
    try {
        // OCF doesn't allow extra fields in their validation
        const incomingIssuerToValidate = {
            id: uuid(),
            object_type: "ISSUER",
            ...req.body,
        };

        console.log("⏳ | Issuer to validate", incomingIssuerToValidate);

        await validateInputAgainstOCF(incomingIssuerToValidate, issuerSchema);

        // in case issuer already exists, return it
        const exists = await readIssuerById(incomingIssuerToValidate.id);
        if (exists && exists._id) {
            return res.status(200).send(`Issuer already exists with id: ${exists._id}`);
        }
        // check if portal exists on fairmint
        await checkPortal({ portalId: incomingIssuerToValidate.id });

        const issuerIdBytes16 = convertUUIDToBytes16(incomingIssuerToValidate.id);

        console.log("💾 | Issuer id in bytes16 ", issuerIdBytes16);

        const { address, deployHash } = await deployCapTable(issuerIdBytes16, incomingIssuerToValidate.initial_shares_authorized);

        const incomingIssuerForDB = {
            ...incomingIssuerToValidate,
            deployed_to: address,
            tx_hash: deployHash,
        };

        const issuer = await createIssuer(incomingIssuerForDB);
        // saving Fairmint Obj by issuer id so we can retrieve it later on event listener
        console.log("🔥 | Creating Fairmint Data for issuer:", issuer._id);
        await createFairmintData({ id: issuer._id });

        console.log("✅ | Issuer created off-chain:", issuer);

        res.status(200).send({ issuer });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

export default issuer;
