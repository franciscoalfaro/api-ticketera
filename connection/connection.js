import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

export const connection = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connection success");
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        throw new Error("The connection has been refused..");
    }
};
