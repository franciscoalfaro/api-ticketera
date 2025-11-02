import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  filename: String,
  path: String,
  mimeType: String
});

const updateSchema = new mongoose.Schema({
  message: String,
  date: { type: Date, default: Date.now },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  attachments: [attachmentSchema]
});

const ticketSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  subject: { type: String, required: true },
  description: { type: String },

  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  /**
   * Relaciones dinámicas (basadas en List.items)
   * No se usa ref porque los items están embebidos en List
   * Se resolverán manualmente en el servicio.
   */
  status: { type: mongoose.Schema.Types.ObjectId, default: null },       // Estados de Ticket
  priority: { type: mongoose.Schema.Types.ObjectId, default: null },    // Prioridades
  impact: { type: mongoose.Schema.Types.ObjectId, default: null },      // Impacto
  department: { type: mongoose.Schema.Types.ObjectId, default: null },  // Departamentos
  type: { type: mongoose.Schema.Types.ObjectId, default: null },        // Tipos de Ticket
  source: { type: mongoose.Schema.Types.ObjectId, default: null },      // Medios de Reporte

  attachments: [attachmentSchema],
  updates: [updateSchema],

  // Cierre y auditoría
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  closedAt: { type: Date, default: Date.now },

  // Estado general
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware para mantener actualizado el campo `updatedAt`
ticketSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Ticket = mongoose.model("Ticket", ticketSchema);
export default Ticket;
