import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        default: 0
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
});

const listSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },  // Ej: "Departamentos"
    type: { 
        type: String, 
        required: true, 
        trim: true 
    },  // Ej: "ticket" o "sistema"
    description: { 
        type: String, 
        default: null },
    items: [itemSchema],
    createdAt: { 
        type: Date, default: Date.now 
    },
    isDeleted: { 
        type: Boolean, 
        default: false 
    },
    deletedAt: { 
        type: Date, default: null 
    }
});

const List = mongoose.model("List", listSchema);
export default List;
