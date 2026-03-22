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

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Búsqueda por nombre (muy común)
listSchema.index({ name: 1 });                    // Búsqueda por nombre exacto
listSchema.index({ type: 1 });                    // Búsqueda por tipo
listSchema.index({ isDeleted: 1 });               // Filtrar eliminadas

// Índices compuestos para búsquedas específicas
listSchema.index({ name: 1, isDeleted: 1 });      // Listas activas por nombre (más usado)
listSchema.index({ type: 1, isDeleted: 1 });      // Listas activas por tipo

// Índice temporal
listSchema.index({ createdAt: -1 });              // Ordenamiento temporal

const List = mongoose.model("List", listSchema);
export default List;
