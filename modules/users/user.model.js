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
        default: '',
        required: false,
        unique: true,
        sparse: true,
    },
    password: {
        type: String
    },
    role: {
        type: String,
        enum: ["agente", "admin", "cliente"], // roles permitidos
        default: "agente"
    },
    type: {
        type: String,
        enum: ['local', 'microsoft'],
        default: 'local'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
});

const User = mongoose.model("User", userSchema);
export default User;
