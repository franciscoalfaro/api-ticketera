import Ticket from "./ticket.model.js";
import fs from "fs";
import path from "path";

// 🔹 Generar correlativo automático
export const generateTicketCode = async () => {
  const lastTicket = await Ticket.findOne().sort({ createdAt: -1 });
  let counter = 1;
  if (lastTicket && lastTicket.code) {
    const num = parseInt(lastTicket.code.split("-")[1]);
    if (!isNaN(num)) counter = num + 1;
  }
  return `TCK-${counter.toString().padStart(4, "0")}`;
};

// 🔹 Crear ticket manual o automático
export const createTicketService = async ({ subject, description, requester, source, attachments = [] }) => {
  const code = await generateTicketCode();

  const ticket = await Ticket.create({
    code,
    subject,
    description,
    requester,
    source,
    attachments,
  });

  return ticket;
};

// 🔹 Obtener tickets paginados
export const getTicketsService = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [tickets, total] = await Promise.all([
    Ticket.find({ isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Ticket.countDocuments({ isDeleted: false }),
  ]);

  return {
    tickets,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  };
};

// 🔹 Adjuntar archivos manualmente
export const attachFilesService = async (ticketId, files) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error("Ticket no encontrado");

  const attachments = files.map((file) => ({
    filename: file.originalname,
    path: file.path,
    mimeType: file.mimetype,
  }));

  ticket.attachments.push(...attachments);
  await ticket.save();

  return ticket;
};

// 🔹 Eliminar ticket (lógicamente)
export const deleteTicketService = async (id) => {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new Error("Ticket no encontrado");

  ticket.isDeleted = true;
  ticket.deletedAt = new Date();
  await ticket.save();

  return { status: "success", message: "Ticket eliminado lógicamente" };
};
