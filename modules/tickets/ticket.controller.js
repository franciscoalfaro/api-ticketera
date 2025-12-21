import List from "../list/list.model.js";
import { sendTicketResponseEmail } from "../mail-processor/mail.utils.js";
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

    // =====================================================
    // 🔹 1. Adjuntos con Multer
    // =====================================================
    const attachments = req.files?.map(f => ({
      filename: f.filename,
      path: `/uploads/tickets/${f.filename}`,
      url: `/uploads/tickets/${f.filename}`,
      mimeType: f.mimetype,
    })) || [];

    // =====================================================
    // 🔹 2. Si no viene status → buscar "Pendiente"
    // =====================================================
    let statusId = status;

    if (!statusId) {
      const statusList = await List.findOne({ name: "Estados de Ticket" }).lean();

      if (!statusList) {
        throw new Error("No se encontró la lista 'Estados de Ticket'");
      }

      const pending = statusList.items.find(i => i.value === "pending");

      if (!pending) {
        throw new Error("No se encontró el estado 'Pendiente'");
      }

      statusId = pending._id; // 👈 aquí asignamos su ObjectId real
    }

    // =====================================================
    // 🔹 3. Crear ticket con status correcto
    // =====================================================
    const ticket = await TicketService.createTicketService({
      subject,
      description,
      requester,
      assignedTo,
      department,
      type,
      source,
      status: statusId,
      priority,
      impact,
      attachments,
    });

    // =====================================================
    // 🔹 4. Enviar email de confirmación al 
    // =====================================================
    const fromUser = await TicketService.getUserByIdService(requester);
    const from = fromUser?.email;

    if (!from) {
      console.warn("⚠️ El usuario no tiene email, no se envía confirmación");
    } else {
      const processedHtml = (description || "").replace(/\n/g, "<br/>");

      await sendTicketResponseEmail({
        to: from,
        ticketCode: ticket.code,
        subject: `Ticket creado: ${ticket.code}`,
        message: `
      Tu ticket ha sido creado correctamente.<br/><br/>

      <b>Código:</b> ${ticket.code}<br/>
      <b>Asunto:</b> ${subject}<br/><br/>

      <b>Descripción:</b><br/>
      ${processedHtml}<br/><br/>

      Puedes responder este correo para continuar la conversación.
    `,
      });
    }


    res.status(201).json({ status: "success", ticket });

  } catch (error) {
    console.error(error);
    res.status(400).json({ status: "error", message: error.message });
  }
};



export const getTicketById = async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await TicketService.getTicketByIdService(id);

    if (!ticket)
      return res.status(404).json({ status: "error", message: "Ticket no encontrado" });

    res.json({ status: "success", ticket });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: error.message });
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
    const id = req.body.idTicket;
    const userId = req.user.id;

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


export const getUpdatesSummary = async (req, res) => {
  try {
    const result = await TicketService.getUpdatesSummaryService(req.params.id);

    if (!result) {
      return res.status(404).json({ status: "error", message: "Ticket no encontrado" });
    }

    return res.json({ status: "success", updates: result });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 📌 Una actualización
export const getUpdateById = async (req, res) => {
  try {
    const update = await TicketService.getUpdateByIdService(req.params.updateId);

    if (!update) {
      return res.status(404).json({ status: "error", message: "Actualización no encontrada" });
    }

    return res.json({ status: "success", update });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

