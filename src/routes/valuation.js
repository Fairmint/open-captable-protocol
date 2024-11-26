import { Router } from "express";
import { v4 as uuid } from "uuid";
import valuationSchema from "../../ocf/schema/objects/Valuation.schema.json";
import { createValuation } from "../db/operations/create.js";
import { countValuations, readIssuerById, readValuationById } from "../db/operations/read.js";
import validateInputAgainstOCF from "../utils/validateInputAgainstSchema.js";

const valuation = Router();

valuation.get("/", async (req, res) => {
    res.send(`Hello Valuation!`);
});

valuation.get("/id/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const valuation = await readValuationById(id);
        res.status(200).send(valuation);
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

valuation.get("/total-number", async (_, res) => {
    try {
        const totalValuations = await countValuations();
        res.status(200).send(totalValuations.toString());
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

/// @dev: stock plan is currently only created offchain
valuation.post("/create", async (req, res) => {
    const { data, issuerId } = req.body;
    try {
        const issuer = await readIssuerById(issuerId);

        const incomingValuationToValidate = {
            id: uuid(),
            object_type: "VALUATION",
            ...data,
        };

        const incomingValuationForDB = {
            ...incomingValuationToValidate,
            issuer: issuer._id,
        };

        await validateInputAgainstOCF(incomingValuationToValidate, valuationSchema);
        const valuation = await createValuation(incomingValuationForDB);

        console.log("Created Valuation in DB: ", valuation);

        res.status(200).send({ valuation });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

export default valuation;
