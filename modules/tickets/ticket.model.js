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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
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
  // re-apertura y auditoría cuando sea reabierto el ticket se indicara el nombre y fecha de la apertura. 

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

// =====================================================
// 🔹 ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
// =====================================================

// Índices para búsquedas y filtrados comunes
ticketSchema.index({ isDeleted: 1, createdAt: -1 });      // Listar tickets (ordenado por fecha)
ticketSchema.index({ assignedTo: 1, status: 1 });         // Tickets por agente y estado
ticketSchema.index({ requester: 1, createdAt: -1 });      // Tickets del cliente (ordenado)
ticketSchema.index({ createdBy: 1, createdAt: -1 });      // Tickets creados por usuario
ticketSchema.index({ status: 1, isDeleted: 1 });          // Filtrar por estado
ticketSchema.index({ priority: 1, createdAt: -1 });       // Tickets por prioridad
ticketSchema.index({ source: 1 });                        // Tickets por medio de reporte
ticketSchema.index({ createdAt: -1 });                    // Ordenamiento temporal

// Índice compuesto para dashboards y reportes
ticketSchema.index({ assignedTo: 1, status: 1, createdAt: -1 }); // Dashboard de agentes
ticketSchema.index({ department: 1, status: 1, createdAt: -1 }); // Por departamento

// Índices para búsquedas de texto (opcional, solo si se implementa full-text search)
// ticketSchema.index({ subject: "text", description: "text" });

const Ticket = mongoose.model("Ticket", ticketSchema);
export default Ticket;
