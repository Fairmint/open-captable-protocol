import mongoose from "mongoose";
import { setupEnv } from "../../utils/env";

setupEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_OVERRIDE = process.env.DATABASE_OVERRIDE;

export const connectDB = async () => {
    const connectOptions = DATABASE_OVERRIDE ? { dbName: DATABASE_OVERRIDE } : {};
    try {
        if (!DATABASE_URL) {
            throw new Error("DATABASE_URL is not defined");
        }
        const sanitizedDatabaseURL = DATABASE_URL.replace(/\/\/(.*):(.*)@/, "//$1:***@");
        console.log(" Mongo connecting...", sanitizedDatabaseURL);
        await mongoose.connect(DATABASE_URL, connectOptions);
        console.log("✅ | Mongo connected successfully", sanitizedDatabaseURL);
        return mongoose.connection;
    } catch (error) {
        console.error(error);
        console.error("❌ | Error connecting to Mongo", error);
        // Exit process with failure
        process.exit(1);
    }
};
