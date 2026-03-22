import List from "../list/list.model.js";
import { sendTicketResponseEmail } from "../mail-processor/mail.utils.js";
import * as TicketService from "./ticket.service.js";
import User from "../users/user.model.js"; // Asegúrate de importar el modelo User
import { createLog } from "../logs/logs.service.js";

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
    // 🔹 4. Enviar email de confirmación con header X-Ticket-ID
    // =====================================================
    // Obtener el email del usuario que crea el ticket
    const fromUser = await User.findById(requester).select('email name');
    const fromEmail = fromUser?.email;

    if (!fromEmail) {
      console.warn("⚠️ El usuario no tiene email, no se envía confirmación");
    } else {
      // Procesar HTML para mostrar saltos de línea
      const processedHtml = (description || "").replace(/\n/g, "<br/>");

      // Enviar correo con el header X-Ticket-ID incluido
      await sendTicketResponseEmail({
        to: fromEmail,
        ticketCode: ticket.code, // Este será usado en el header X-Ticket-ID
        subject: subject || "Ticket creado",
        message: processedHtml,
      });
    }

    res.status(201).json({ 
      status: "success", 
      ticket,
      message: `Ticket ${ticket.code} creado exitosamente` 
    });

    await createLog({
      user: req.user?.id || requester,
      action: "CREAR_TICKET",
      module: "tickets",
      description: `Ticket creado: ${ticket.code} por usuario ${req.user?.name}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

  } catch (error) {
    console.error("❌ Error creando ticket:", error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_CREAR_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(400).json({ 
      status: "error", 
      message: error.message 
    });
  }
};


export const getTicketById = async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await TicketService.getTicketByIdService(id);

    if (!ticket) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_OBTENER_TICKET",
        module: "tickets",
        description: `Ticket no encontrado ${id}`,
        status: "error",
        method: "GET",
        ip: req.clientIp,
      });
      return res.status(404).json({ status: "error", message: "Ticket no encontrado" });
    }
    // guardar dentro de la descripcion el id del usuario que hizo la consulta y el nombre del usuario
    await createLog({
      user: req.user?.id,
      action: "OBTENER_TICKET",
      module: "tickets",
      description: `Consulta ticket ${ticket.code} por usuario ${req.user?.name}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });

    res.json({ status: "success", ticket });

  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Obtener tickets
export const getTickets = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await TicketService.getTicketsService(page);
    await createLog({
      user: req.user?.id,
      action: "LISTAR_TICKETS",
      module: "tickets",
      description: `Listado de tickets página ${page}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", ...data });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_TICKETS",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Tickets del usuario
export const getMyTickets = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await TicketService.getMyTicketsService(req.user.id, page);
    await createLog({
      user: req.user?.id,
      action: "LISTAR_MIS_TICKETS",
      module: "tickets",
      description: `Listado de tickets del usuario página ${page}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", ...data });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_MIS_TICKETS",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Actualizar ticket
export const updateTicket = async (req, res) => {
  try {
    const id = req.body.idTicket;
    const userId = req.user.id;

    const updated = await TicketService.updateTicketService(id, userId, req.body);
    console.log("Ticket actualizado:", updated);
    await createLog({
      user: userId,
      action: "ACTUALIZAR_TICKET",
      module: "tickets",
      description: `Ticket ${updated.code} actualizado por usuario ${req.user?.name}`,
      status: "success",
      method: "PUT",
      ip: req.clientIp,
    });

    res.json({ status: "success", ticket: updated });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_ACTUALIZAR_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "PUT",
      ip: req.clientIp,
    });
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
    await createLog({
      user: userId,
      action: "AGREGAR_ACTUALIZACION_TICKET",
      module: "tickets",
      description: `Actualización agregada al ticket ${idTicket}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });
    res.json({ status: "success", ticket: updatedTicket });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_AGREGAR_ACTUALIZACION_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar ticket
export const deleteTicket = async (req, res) => {
  try {
    const result = await TicketService.deleteTicketService(req.body.id);
    await createLog({
      user: req.user?.id,
      action: "ELIMINAR_TICKET",
      module: "tickets",
      description: `Ticket eliminado ${req.body.id}`,
      status: "success",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.json(result);
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ELIMINAR_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};


export const getUpdatesSummary = async (req, res) => {
  try {
    const result = await TicketService.getUpdatesSummaryService(req.params.id);

    if (!result) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_RESUMEN_ACTUALIZACIONES_TICKET",
        module: "tickets",
        description: `Ticket no encontrado ${req.params.id}`,
        status: "error",
        method: "GET",
        ip: req.clientIp,
      });
      return res.status(404).json({ status: "error", message: "Ticket no encontrado" });
    }

    await createLog({
      user: req.user?.id,
      action: "RESUMEN_ACTUALIZACIONES_TICKET",
      module: "tickets",
      description: `Resumen de actualizaciones para ticket ${req.params.id}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });

    return res.json({ status: "success", updates: result });

  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_RESUMEN_ACTUALIZACIONES_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 📌 Una actualización
export const getUpdateById = async (req, res) => {
  try {
    const update = await TicketService.getUpdateByIdService(req.params.updateId);

    if (!update) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_OBTENER_ACTUALIZACION_TICKET",
        module: "tickets",
        description: `Actualización no encontrada ${req.params.updateId}`,
        status: "error",
        method: "GET",
        ip: req.clientIp,
      });
      return res.status(404).json({ status: "error", message: "Actualización no encontrada" });
    }

    await createLog({
      user: req.user?.id,
      action: "OBTENER_ACTUALIZACION_TICKET",
      module: "tickets",
      description: `Consulta actualización ${req.params.updateId}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });

    return res.json({ status: "success", update });

  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_ACTUALIZACION_TICKET",
      module: "tickets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
};

