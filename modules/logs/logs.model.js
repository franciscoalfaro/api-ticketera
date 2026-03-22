import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // en caso de acciones del sistema
  },
  action: {
    type: String,
    required: true,
  },
  module: {
    type: String, // ejemplo: 'users', 'tickets', 'lists'
  },
  description: {
    type: String,
  },
  method: {
    type: String, // HTTP method o tipo de evento
  },
  status: {
    type: String,
    enum: ["success", "error", "warning", "info"],
    default: "info",
  },
  ip: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Índices para auditoría y búsqueda
logSchema.index({ user: 1, createdAt: -1 });           // Logs de usuario (ordenado)
logSchema.index({ module: 1, createdAt: -1 });         // Logs por módulo
logSchema.index({ status: 1, createdAt: -1 });         // Logs por estado
logSchema.index({ createdAt: -1 });                    // Logs generales (orden temporal)
logSchema.index({ user: 1, action: 1, createdAt: -1 }); // Acciones de usuario

// Índice compuesto para auditoría completa
logSchema.index({ module: 1, status: 1, createdAt: -1 }); // Auditoría por módulo

// TTL Index: Eliminar logs automáticamente después de 90 días (opcional)
// logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 días

const Log = mongoose.model("Log", logSchema);
export default Log;
