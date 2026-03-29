import mongoose from "mongoose";

const ticketAssignmentLogSchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket",
    required: true,
    index: true,
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  action: {
    type: String,
    enum: ["assigned", "reassigned", "unassigned"],
    required: true,
  },
  reason: {
    type: String,
    default: null,
    trim: true,
    maxlength: 500,
  },
  at: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  versionKey: false,
});

ticketAssignmentLogSchema.index({ ticket: 1, at: -1 });
ticketAssignmentLogSchema.index({ changedBy: 1, at: -1 });
ticketAssignmentLogSchema.index({ toUser: 1, at: -1 });
ticketAssignmentLogSchema.index({ action: 1, at: -1 });

const TicketAssignmentLog = mongoose.model("TicketAssignmentLog", ticketAssignmentLogSchema);

export default TicketAssignmentLog;
