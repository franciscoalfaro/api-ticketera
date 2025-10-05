import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    microsoftId: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ["agente", "admin", "cliente"], // roles permitidos
        default: "agente"
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

const User = mongoose.model("User", userSchema);
export default User;
