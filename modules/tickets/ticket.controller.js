import * as TicketService from "./ticket.service.js";

// Crear ticket (manual o automático)
export const createTicket = async (req, res) => {
  try {
    const { subject, description, requester, source } = req.body;
    const attachments = req.files?.map((f) => ({
      filename: f.originalname,
      path: f.path,
      mimeType: f.mimetype,
    })) || [];

    const ticket = await TicketService.createTicketService({
      subject,
      description,
      requester,
      source: source || "manual",
      attachments,
    });

    res.status(201).json({ status: "success", ticket });
  } catch (error) {
    console.error(error);
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Listar tickets paginados
export const getTickets = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await TicketService.getTicketsService(page);
    res.json({ status: "success", ...data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Agregar archivos a un ticket existente
export const addAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await TicketService.attachFilesService(id, req.files);
    res.json({ status: "success", ticket: updated });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar ticket
export const deleteTicket = async (req, res) => {
  try {
    const result = await TicketService.deleteTicketService(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
