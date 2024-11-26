import { Router } from "express";
import { v4 as uuid } from "uuid";
import {
    addWalletToStakeholder,
    convertAndReflectStakeholderOnchain,
    getStakeholderById,
    getTotalNumberOfStakeholders,
    removeWalletFromStakeholder,
} from "../controllers/stakeholderController.js"; // Importing the controller functions

import stakeholderSchema from "../../ocf/schema/objects/Stakeholder.schema.json";
import { createStakeholder } from "../db/operations/create.js";
import { readIssuerById, readStakeholderById, getAllStakeholdersByIssuerId } from "../db/operations/read.js";
import validateInputAgainstOCF from "../utils/validateInputAgainstSchema.js";

const stakeholder = Router();

stakeholder.get("/", async (req, res) => {
    res.send(`Hello stakeholder!`);
});

// offchain
stakeholder.get("/fetch-offchain/id/:id", async (req, res) => {
    const { id } = req.params;

    if (!id) return res.status(400).send(`Missing id`);

    console.log("fetch offchain stakeholder with ID ");

    try {
        const stakeholder = await readStakeholderById(id);

        return res.status(200).send({ stakeholder });
    } catch (error) {
        console.error(error);
        return res.status(500).send(`${error}`);
    }
});

// onchain
stakeholder.get("/id/:id", async (req, res) => {
    const { contract } = req;
    const { id } = req.params;

    try {
        const { stakeholderId, type, role } = await getStakeholderById(contract, id);

        return res.status(200).send({ stakeholderId, type, role });
    } catch (error) {
        console.error(error);
        return res.status(500).send(`${error}`);
    }
});

stakeholder.get("/fetch-all", async (req, res) => {
    const { issuerId } = req.body;
    console.log("calling fetch all issuers");

    try {
        const stakeholders = await getAllStakeholdersByIssuerId(issuerId);

        console.log("stakeholders", stakeholder);

        return res.status(200).send({ stakeholders });
    } catch (error) {
        console.error(error);
        return res.status(500).send(`${error}`);
    }
});

stakeholder.get("/total-number", async (req, res) => {
    const { contract } = req;

    try {
        const totalStakeholders = await getTotalNumberOfStakeholders(contract);
        res.status(200).send(totalStakeholders);
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

stakeholder.post("/create", async (req, res) => {
    const { contract } = req;
    const { data, issuerId } = req.body;

    try {
        const issuer = await readIssuerById(issuerId);

        // OCF doesn't allow extra fields in their validation
        const incomingStakeholderToValidate = {
            id: uuid(),
            object_type: "STAKEHOLDER",
            ...data,
        };

        const incomingStakeholderForDB = {
            ...incomingStakeholderToValidate,
            issuer: issuer._id,
        };

        await validateInputAgainstOCF(incomingStakeholderToValidate, stakeholderSchema);
        console.log(`Checking if Stakeholder id: ${incomingStakeholderToValidate.id} exists`);
        const existingStakeholder = await readStakeholderById(incomingStakeholderToValidate.id);

        if (existingStakeholder && existingStakeholder._id) {
            return res.status(200).send({
                message: "Stakeholder already created",
                stakeholder: existingStakeholder,
            });
        }

        // Save offchain
        const stakeholder = await createStakeholder(incomingStakeholderForDB);

        // Save onchain
        await convertAndReflectStakeholderOnchain(contract, incomingStakeholderForDB.id);

        console.log("✅ | Stakeholder created offchain:", stakeholder);

        res.status(200).send({ stakeholder });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

stakeholder.post("/add-wallet", async (req, res) => {
    const { contract } = req;
    const { id, wallet } = req.body;

    try {
        // TODO: handle wallet already exists: maybe add a getter wallet from smart contract?
        await addWalletToStakeholder(contract, id, wallet);
        res.status(200).send("Success");
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

stakeholder.post("/remove-wallet", async (req, res) => {
    const { contract } = req;
    const { id, wallet } = req.body;

    try {
        await removeWalletFromStakeholder(contract, id, wallet);
        res.status(200).send("Success");
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

export default stakeholder;
