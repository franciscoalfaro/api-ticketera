// modules/counter/counter.model.js
import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Índice único para búsqueda por nombre (crítico)
CounterSchema.index({ name: 1 }, { unique: true });

export default mongoose.model("Counter", CounterSchema);
