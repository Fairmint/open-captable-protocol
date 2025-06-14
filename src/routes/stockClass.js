import { Router } from "express";
import { v4 as uuid } from "uuid";
import stockClassSchema from "../../ocf/schema/objects/StockClass.schema.json";
import { convertAndReflectStockClassOnchain, getStockClassById, getTotalNumberOfStockClasses } from "../controllers/stockClassController.js";
import { createStockClass } from "../db/operations/create.js";
import { readIssuerById, readStockClassById } from "../db/operations/read.js";
import validateInputAgainstOCF from "../utils/validateInputAgainstSchema.js";
import Stockclass from "../db/objects/StockClass";
import Issuer from "../db/objects/Issuer";

const stockClass = Router();

stockClass.get("/", async (req, res) => {
    res.send(`Hello Stock Class!`);
});

stockClass.get("/id/:id", async (req, res) => {
    const { contract } = req;
    const { id } = req.params;

    try {
        const { stockClassId, classType, pricePerShare, initialSharesAuthorized } = await getStockClassById(contract, id);

        res.status(200).send({ stockClassId, classType, pricePerShare, initialSharesAuthorized });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

stockClass.get("/total-number", async (req, res) => {
    const { contract } = req;
    try {
        const totalStockClasses = await getTotalNumberOfStockClasses(contract);
        res.status(200).send(totalStockClasses);
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

/// @dev: stock class is always created onchain, then to the DB
stockClass.post("/create", async (req, res) => {
    const { contract } = req;
    const { data, issuerId } = req.body;

    try {
        const issuer = await readIssuerById(issuerId);
        if (!issuer) {
            return res.status(404).send({ message: "Issuer not found" });
        }

        // OCF doesn't allow extra fields in their validation
        const incomingStockClassToValidate = {
            id: uuid(),
            object_type: "STOCK_CLASS",
            ...data,
        };

        const incomingStockClassForDB = {
            ...incomingStockClassToValidate,
            issuer: issuer._id,
        };
        await validateInputAgainstOCF(incomingStockClassToValidate, stockClassSchema);
        console.log("stockClassId", data.id);
        const exists = await readStockClassById(incomingStockClassToValidate.id);
        if (exists && exists._id) {
            return res.status(200).send({ message: "StockClass already exists", stockClass: exists });
        }

        // Save Offchain
        const stockClass = await createStockClass(incomingStockClassForDB);

        // Save Onchain
        const {
            hash: tx_hash,
            stockClassContractId,
            updatedIssuerContractId,
        } = await convertAndReflectStockClassOnchain(contract, incomingStockClassForDB, issuer);
        await Stockclass.findByIdAndUpdate(stockClass._id, { tx_hash, contract_id: stockClassContractId ?? null });
        console.log("✅ | Stock Class created offchain:", stockClass);

        if (updatedIssuerContractId) {
            await Issuer.findByIdAndUpdate(issuerId, { deployed_to: updatedIssuerContractId });
            console.log("✅ | Issuer updated offchain:", issuer);
        }

        res.status(200).send({ stockClass: { ...stockClass.toObject(), tx_hash: tx_hash ?? null } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

export default stockClass;
