import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  filename: String,
  path: String,
  mimeType: String,
});

const updateSchema = new mongoose.Schema({
  message: String,
  date: { type: Date, default: Date.now },
  author: String,
});

const ticketSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true }, // Ej: TCK-0001
  subject: { type: String, required: true },
  description: { type: String },
  requester: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  source: { type: String, enum: ["manual", "correo"], default: "manual" },
  status: {
    type: String,
    enum: ["abierto", "pendiente", "en progreso", "cerrado"],
    default: "abierto",
  },
  priority: {
    type: String,
    enum: ["baja", "media", "alta"],
    default: "media",
  },
  impact: { type: String, default: null },
  attachments: [attachmentSchema],
  updates: [updateSchema],
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
});

const Ticket = mongoose.model("Ticket", ticketSchema);
export default Ticket;
