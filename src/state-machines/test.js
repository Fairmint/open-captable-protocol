import processSM from "./process.js";
import transactions from "../../src/db/samples/fairmint/Transactions.ocf.json" assert { type: "json" };
import manifest from "../../src/db/samples/fairmint/Manifest.ocf.json" assert { type: "json" };
import stockClasses from "../../src/db/samples/fairmint/StockClasses.ocf.json" assert { type: "json" };

processSM(manifest.issuer, transactions, stockClasses);
