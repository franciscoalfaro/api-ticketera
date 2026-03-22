import mongoose from "mongoose";

const enterpriseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  image: {
    type: String,
    default: "default.png"
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Índice único para nombre
enterpriseSchema.index({ name: 1 }, { unique: true });

// Índices para búsquedas comunes
enterpriseSchema.index({ isDeleted: 1 });        // Filtrar eliminadas
enterpriseSchema.index({ createdAt: -1 });      // Ordenamiento temporal

const Enterprise = mongoose.model("Enterprise", enterpriseSchema);
export default Enterprise;
