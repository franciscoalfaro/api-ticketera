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

const Log = mongoose.model("Log", logSchema);
export default Log;
