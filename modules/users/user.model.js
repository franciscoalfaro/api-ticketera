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
    sparse: true
  },
  password: {
    type: String
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "List.items", // referencia al item dentro de una lista (roles)
    default: null
  },
  type: {
    type: String,
    enum: ['local', 'microsoft'],
    default: 'local'
  },
  area: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Area",
    default: null
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
  }
});

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Índices para búsquedas comunes
userSchema.index({ isDeleted: 1 });           // Filtrar usuarios eliminados
userSchema.index({ type: 1 });                // Filtrar por tipo (local/microsoft)
userSchema.index({ area: 1 });                // Usuarios por área
userSchema.index({ role: 1 });                // Usuarios por rol
userSchema.index({ isDeleted: 1, type: 1 }); // Usuarios activos por tipo

// Índice temporal
userSchema.index({ createdAt: -1 });          // Ordenamiento temporal

const User = mongoose.model("User", userSchema);
export default User;
