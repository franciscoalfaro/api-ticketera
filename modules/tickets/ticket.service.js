import Ticket from "./ticket.model.js";
import List from "../list/list.model.js";
import User from "../users/user.model.js";
import path from "path";
import { generateDailyReport } from "../reports/reports.service.js";

// Generar correlativo automático
import Counter from "../counter/counter.model.js";


// Obtener usuario por ID
export const getUserById = async (id) => {
  // Buscar el usuario con su área
  const user = await User.findById(id)
    .populate("area", "name color")
    .select("-password");

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  // Buscar la lista de roles
  const rolesList = await List.findOne({ name: "Roles de Usuario", isDeleted: false });

  // Buscar el rol correspondiente dentro de la lista
  const role = rolesList?.items?.id(user.role);

  // Enriquecer la respuesta
  const enrichedUser = {
    ...user.toObject(),
    role: role
      ? { label: role.label, value: role.value, color: role.color }
      : null,
  };

  return enrichedUser;
};


let currentBatch = {
  min: 0,
  max: 0,
  current: 0
};

export const generateTicketCode = async () => {
  // Si el batch está agotado, obtener uno nuevo
  if (currentBatch.current >= currentBatch.max) {
    const batchSize = 1000; // Tamaño del batch
    const counter = await Counter.findOneAndUpdate(
      { name: "tickets" },
      { $inc: { value: batchSize } },
      { new: true, upsert: true }
    );

    currentBatch = {
      min: counter.value - batchSize + 1,
      max: counter.value,
      current: counter.value - batchSize + 1 // Comienza desde el primer número del batch
    };
  }

  // Generar código secuencial
  const ticketNumber = currentBatch.current++;
  return `TCK-${String(ticketNumber).padStart(4, "0")}`;
};


// Crear ticket
export const createTicketService = async (data) => {
  // Generar código automático
  const code = await generateTicketCode();
  const ticket = new Ticket({
    code,
    ...data
  });

  await ticket.save();
  await generateDailyReport(ticket.createdAt);
  return ticket;
};

// Obtener todos los tickets (paginado)
export const getTicketsService = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    Ticket.find({ isDeleted: false })
      .populate("requester", "name email")
      .populate("assignedTo", "name email")
      .populate("closedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments({ isDeleted: false }),
  ]);

  // ✅ Nombres de listas correctos
  const lists = await List.find({
    name: {
      $in: [
        "Estados de Ticket",
        "Prioridades",
        "Impacto",
        "Departamentos",
        "Tipos de Ticket",
        "Medios de Reporte",
      ],
    },
  }).lean();

  const findItemById = (id) => {
    for (const list of lists) {
      const item = list.items.find((i) => i._id.toString() === id?.toString());
      if (item) return { label: item.label, value: item.value, _id: item._id };
    }
    return null;
  };

  const enrichedTickets = tickets.map((t) => ({
    ...t,
    source: findItemById(t.source),
    status: findItemById(t.status),
    priority: findItemById(t.priority),
    impact: findItemById(t.impact),
    department: findItemById(t.department),
    type: findItemById(t.type),
  }));

  return {
    tickets: enrichedTickets,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getTicketByIdService = async (id) => {
  const ticket = await Ticket.findById(id)
    .populate("requester", "name email role")
    .populate("assignedTo", "name email")
    .populate("closedBy", "name email")
    .lean();

  if (!ticket) return null;

  // 🔹 Traemos las listas necesarias
  const lists = await List.find({
    name: { $in: ["Estados de Ticket", "Prioridades", "Impacto", "Departamentos", "Tipos de Ticket", "Medios de Reporte"] },
  }).lean();

  // 🔹 Buscador de item por ID
  const findItemById = (id) => {
    for (const list of lists) {
      const item = list.items.find((i) => i._id.toString() === id?.toString());
      if (item) return { label: item.label, value: item.value, _id: item._id };
    }
    return null;
  };

  // 🔹 Enriquecer campos relacionados
  return {
    ...ticket,
    status: findItemById(ticket.status),
    priority: findItemById(ticket.priority),
    impact: findItemById(ticket.impact),
    department: findItemById(ticket.department),
    type: findItemById(ticket.type),
    source: findItemById(ticket.source),
  };
};


// Obtener tickets asignados al usuario autenticado
export const getMyTicketsService = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const filter = { isDeleted: false, assignedTo: userId };

  const [tickets, total] = await Promise.all([
    Ticket.find(filter).populate("assignedTo", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter),
  ]);

  return { tickets, currentPage: page, totalPages: Math.ceil(total / limit), totalTickets: total };
};

// Adjuntar archivos a un ticket
export const attachFilesService = async (ticketId, files) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error("Ticket no encontrado");

  const attachments = files.map((file) => ({
    filename: file.originalname,
    path: file.path.replace(`${process.cwd()}${path.sep}`, "").replace(/\\/g, "/"),
    mimeType: file.mimetype,
  }));

  ticket.attachments.push(...attachments);
  await ticket.save();
  return ticket;
};


// Actualizar ticket (estado, prioridad, asignado, etc.)
export const updateTicketService = async (id, userId, data) => {

  const ticket = await Ticket.findById(id);
  if (!ticket) throw new Error("Ticket no encontrado");

  // 🔹 Buscar el estado "closed" dentro de la lista "Estados de Ticket"
  const estadosList = await List.findOne({ name: "Estados de Ticket" }).lean();
  const estadoCerrado = estadosList?.items.find(i => i.value === "closed");

  // 🔹 Si el estado enviado equivale a "cerrado"
  if (data.status && estadoCerrado && data.status.toString() === estadoCerrado._id.toString()) {
    ticket.closedBy = userId;
    ticket.closedAt = new Date();
  }

  // 🔹 Si el ticket se reabre (estado distinto a "closed"), limpiar datos de cierre
  if (data.status && estadoCerrado && data.status.toString() !== estadoCerrado._id.toString()) {
    ticket.closedBy = null;
    ticket.closedAt = null;
  }

  // 🔹 Campos que pueden actualizarse
  const allowedFields = [
    "subject",
    "description",
    "requester",
    "assignedTo",
    "department",
    "type",
    "source",
    "status",
    "priority",
    "impact"
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      ticket[field] = data[field];
    }
  }

  ticket.updatedAt = new Date();
  await ticket.save();
  await generateDailyReport(ticket.createdAt);

  return ticket;
};


// Agregar comentario o nota
export const addUpdateToTicket = async (id, { message, attachments = [], userId }) => {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new Error("Ticket no encontrado");

  const normalizedAttachments = attachments.map(a => ({
    ...a,
    path: a.path.replace(`${process.cwd()}${path.sep}`, "").replace(/\\/g, "/")
  }));

  ticket.updates.push({
    author: userId,
    message,
    attachments: normalizedAttachments,
    date: new Date(),
  });

  ticket.updatedAt = new Date();
  await ticket.save();
  return ticket;
};

// Eliminación lógica
export const deleteTicketService = async (id) => {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new Error("Ticket no encontrado");
  ticket.isDeleted = true;
  ticket.deletedAt = new Date();
  await ticket.save();
  return { status: "success", message: "Ticket eliminado lógicamente" };
};


export const getDefaultLists = async () => {
  const getItem = async (listName, itemValue) => {
    const list = await List.findOne(
      { name: listName, isDeleted: false },
      { items: 1 }
    );
    if (!list) return null;

    const item = list.items.find(i => i.value === itemValue);
    return item ? item._id : null;
  };

  return {
    department: await getItem("Departamentos", "soporte_ti"),
    priority: await getItem("Prioridades", "media"),
    impact: await getItem("Impacto", "persona"),
    status: await getItem("Estados de Ticket", "open"),
    type: await getItem("Tipos de Ticket", "incidente"), // asegúrate de agregarlo
  };
};

export const getDefaultAgent = async () => {
  // Busca el usuario que configuraste en tu seed:
  // "MDS Virtual", value: "mds_virtual"
  return await User.findOne({ email: "mds_admin@ticketera.local", isDeleted: false });
};


// 📌 Obtener resumen de actualizaciones
export const getUpdatesSummaryService = async (ticketId) => {
  const ticket = await Ticket.findById(ticketId)
    .select("updates")
    .populate("updates.author", "name email")
    .lean();

  if (!ticket) return null;

  return ticket.updates.map(u => ({
    id: u._id,
    date: u.date,
    author: u.author,
  }));
};

// 📌 Obtener una actualización completa por updateId
export const getUpdateByIdService = async (updateId) => {
  const ticket = await Ticket.findOne(
    { "updates._id": updateId },
    { "updates.$": 1 }
  )
    .populate("updates.author", "name email")
    .lean();

  if (!ticket) return null;

  return ticket.updates[0];
};
