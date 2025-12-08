import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  date: { type: Date, required: true },

  totalTickets: { type: Number, default: 0 },
  ticketsClosed: { type: Number, default: 0 },
  ticketsOpen: { type: Number, default: 0 },
  ticketsPending: { type: Number, default: 0 },
  ticketsUnassigned: { type: Number, default: 0 },

  ticketsByDepartment: [
    {
      departmentId: mongoose.Schema.Types.ObjectId,
      total: Number,
    }
  ],

  ticketsByAgent: [
    {
      agentId: mongoose.Schema.Types.ObjectId,
      total: Number,
    }
  ],

  ticketsByPriority: [
    {
      priorityId: mongoose.Schema.Types.ObjectId,
      total: Number,
    }
  ],

  ticketsByStatus: [
    {
      statusId: mongoose.Schema.Types.ObjectId,
      total: Number,
    }
  ],

  avgResolutionTimeHours: { type: Number, default: 0 },   // SLA resolución
  firstResponseTimeHours: { type: Number, default: 0 },   // SLA primer contacto

}, { timestamps: true });

export default mongoose.model("Report", reportSchema);
