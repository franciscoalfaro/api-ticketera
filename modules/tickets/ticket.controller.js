import * as TicketService from "./ticket.service.js";

// Crear ticket
export const createTicket = async (req, res) => {
  try {
    const {
      subject,
      description,
      requester,
      assignedTo,
      department,
      type,
      source,
      status,
      priority,
      impact
    } = req.body;

    const attachments =
      req.files?.map(f => ({
        filename: f.originalname,
        path: f.path,
        mimeType: f.mimetype,
      })) || [];

    const ticket = await TicketService.createTicketService({
      subject,
      description,
      requester,
      assignedTo,
      department,
      type,
      source,
      status,
      priority,
      impact,
      attachments,
    });

    res.status(201).json({ status: "success", ticket });
  } catch (error) {
    console.error(error);
    res.status(400).json({ status: "error", message: error.message });
  }
};


// Obtener tickets
export const getTickets = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await TicketService.getTicketsService(page);
    res.json({ status: "success", ...data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Tickets del usuario
export const getMyTickets = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await TicketService.getMyTicketsService(req.user.id, page);
    res.json({ status: "success", ...data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Actualizar ticket
export const updateTicket = async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.user.id;
    console.log(req.body)
    const updated = await TicketService.updateTicketService(id, userId, req.body);
    res.json({ status: "success", ticket: updated });
  } catch (error) {
    console.error(error);
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Agregar comentario/nota
export const addTicketUpdate = async (req, res) => {
  try {
    const { idTicket, message } = req.body;
    const userId = req.user.id;

    const attachments = req.files?.map(f => ({
      filename: f.originalname,
      path: f.path,
      mimeType: f.mimetype,
    })) || [];

    const updatedTicket = await TicketService.addUpdateToTicket(idTicket, { message, attachments, userId });
    res.json({ status: "success", ticket: updatedTicket });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar ticket
export const deleteTicket = async (req, res) => {
  try {
    const result = await TicketService.deleteTicketService(req.body.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
