import mongoose from "mongoose";

const assetSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    }, // Ej. DM-01
    name: {
        type: String,
        required: true
    },               // Ej. Laptop DM-01
    model: {
        type: String
    },
    serialNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    purchaseDate: {
        type: Date
    },
    description: {
        type: String
    },
    status: {
        type: String,
        enum: ["activo", "stock", "obsoleto", "en reparación"],
        default: "stock",
    },
    location: {
        type: String,
        default: "Oficina principal"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean, default: false
    },
    deletedAt: {
        type: Date, default: null
    },
});

assetSchema.index({ code: 1, name: 1 });

const Asset = mongoose.model("Asset", assetSchema);
export default Asset;
