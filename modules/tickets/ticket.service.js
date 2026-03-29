import Ticket from "./ticket.model.js";
import List from "../list/list.model.js";
import User from "../users/user.model.js";
import path from "path";
import { generateDailyReport } from "../reports/reports.service.js";
import mongoose from "mongoose";

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



// =====================================================
// 🔹 GENERADOR DE CÓDIGOS DE TICKET ROBUSTO
// =====================================================
class TicketCodeGenerator {
  constructor() {
    this.initialized = false;
    this.lastValue = 0;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Verificar si el counter existe (indica si la BD tiene datos históricos)
      const counter = await Counter.findOne({ name: "tickets" });
      
      if (counter) {
        // BD existente: sincronizar con el counter existente
        this.lastValue = counter.value;
        console.log(`✅ Generador inicializado con counter existente. Próximo: TCK-${String(this.lastValue + 1).padStart(4, "0")}`);
      } else {
        // BD nueva: comenzar desde 0
        await Counter.create({ name: "tickets", value: 0 });
        this.lastValue = 0;
        console.log(`✅ Generador inicializado en BD nueva. Comenzará desde: TCK-0001`);
      }
    } catch (error) {
      console.warn("⚠️ Error inicializando generador:", error.message);
      // Si hay error, crear counter con valor 0 para no afectar
      try {
        await Counter.findOneAndUpdate(
          { name: "tickets" },
          { $setOnInsert: { value: 0 } },
          { upsert: true }
        );
      } catch (e) {
        console.error("❌ Error crítico inicializando counter:", e.message);
      }
    }

    this.initialized = true;
  }

  async generateTicketCode() {
    if (!this.initialized) {
      await this.initialize();
    }

    let ticketCode;
    let attempts = 0;
    const maxAttempts = 10;

    // Intentar generar un código único
    while (attempts < maxAttempts) {
      // Incrementar el counter
      const counter = await Counter.findOneAndUpdate(
        { name: "tickets" },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
      );

      const ticketNumber = counter.value;
      ticketCode = `TCK-${String(ticketNumber).padStart(4, "0")}`;

      // Verificar que no exista un ticket con este código
      const existingTicket = await Ticket.findOne({ code: ticketCode }).lean();

      if (!existingTicket) {
        // Código único encontrado
        this.lastValue = ticketNumber;
        return ticketCode;
      }

      // Si existe, intentar de nuevo
      console.warn(`⚠️ Código ${ticketCode} ya existe, generando nuevo...`);
      attempts++;
    }

    // Si llegamos aquí, algo está muy mal
    throw new Error(`No se pudo generar un código único después de ${maxAttempts} intentos`);
  }
}

// Instancia singleton
const generator = new TicketCodeGenerator();

// Función exportada
export const generateTicketCode = async () => {
  return await generator.generateTicketCode();
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

  const objectIdFields = new Set([
    "requester",
    "assignedTo",
    "department",
    "type",
    "source",
    "status",
    "priority",
    "impact",
  ]);

  const nullLikeValues = new Set(["", "null", "undefined", "unknown", "n/a", "na", "none"]);

  const normalizeObjectIdValue = (field, value) => {
    if (value === null) return null;
    if (value === undefined) return undefined;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (nullLikeValues.has(trimmed.toLowerCase())) return null;
      if (mongoose.Types.ObjectId.isValid(trimmed)) return trimmed;
      throw new Error(`Campo "${field}" inválido: debe ser ObjectId válido o null`);
    }

    if (mongoose.Types.ObjectId.isValid(value)) return value;
    throw new Error(`Campo "${field}" inválido: debe ser ObjectId válido o null`);
  };

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (objectIdFields.has(field)) {
        const normalizedValue = normalizeObjectIdValue(field, data[field]);
        if (normalizedValue !== undefined) ticket[field] = normalizedValue;
      } else {
        ticket[field] = data[field];
      }
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
