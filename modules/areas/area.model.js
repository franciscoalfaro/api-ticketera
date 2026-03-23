import mongoose from "mongoose";

const areaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
});

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Índices para búsquedas comunes
areaSchema.index({ isDeleted: 1 });           // Filtrar eliminadas
areaSchema.index({ createdAt: -1 });          // Ordenamiento temporal

const Area = mongoose.model("Area", areaSchema);
export default Area;
