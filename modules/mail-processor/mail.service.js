// modules/mail-processor/mail.service.js

import Ticket from "../tickets/ticket.model.js";
import User from "../users/user.model.js";
import List from "../list/list.model.js";
import {
  createTicketService,
  getDefaultAgent,
  getDefaultLists,
} from "../tickets/ticket.service.js";

import {
  fetchSupportEmails,
  markAsRead,
  sendTicketResponseEmail,
  processInlineImages,
  replaceCidImages,
  processRegularAttachments,
} from "./mail.utils.js";
import { generateDailyReport } from "../reports/reports.service.js";

const ALLOWED_DOMAINS = ["@hotmail.cl", "@gmail.com", "@franciscoalfaro.cl"];

// =====================================================
// 🔹 PROCESAR UN SOLO CORREO
// =====================================================
export const processIncomingMail = async (mail) => {
  try {
    const from = mail.from?.emailAddress?.address || null;
    const subject = mail.subject || "Sin asunto";
    const rawHtml = mail.body?.content || "";
    const attachments = mail.attachments || [];
    const messageId = mail.internetMessageId; // Importante para tracking

    if (!from) return;

    if (!ALLOWED_DOMAINS.some((d) => from.endsWith(d))) {
      console.log(`⚠️ Correo ignorado: ${from}`);
      return;
    }

    // 1. Procesar imágenes y adjuntos
    const cidMap = await processInlineImages(attachments);
    const processedHtml = replaceCidImages(rawHtml, cidMap);
    const regularFiles = await processRegularAttachments(attachments);

    // 2. Mejorar detección del ticket (múltiples métodos)
    const ticketCode = await detectTicketCode(mail, subject);

    // 3. Buscar usuario (optimizado)
    let requester = await findOrCreateUser(from);

    // =====================================================
    // 🔹 4. PROCESAR TICKET (NUEVO O ACTUALIZACIÓN)
    // =====================================================
    if (ticketCode) {
      // Intentar actualizar ticket existente
      const updatedTicket = await updateExistingTicket(
        ticketCode,
        requester._id,
        processedHtml,
        regularFiles,
        messageId
      );

      if (updatedTicket) {
        console.log(`✉️ Ticket ${ticketCode} actualizado`);
        return { ...updatedTicket.toObject(), isUpdate: true };
      }
    }

    // Si no se encontró ticket para actualizar, crear uno nuevo
    return await createNewTicket(
      subject,
      processedHtml,
      requester,
      regularFiles,
      from,
      messageId
    );

  } catch (error) {
    console.error("❌ Error procesando correo:", error);
    throw error; // Importante para debugging
  }
};

// =====================================================
// 🔹 FUNCIONES AUXILIARES (MEJOR ORGANIZADAS)
// =====================================================

/**
 * Detecta el código de ticket de múltiples formas
 */
async function detectTicketCode(mail, subject) {
  // 1. Buscar en headers (método más confiable)
  const headers = mail.internetMessageHeaders || [];
  const headerTicket = headers.find(h =>
    h.name.toLowerCase() === "x-ticket-id" ||
    h.name.toLowerCase() === "in-reply-to" ||
    h.name.toLowerCase() === "references"
  )?.value;

  if (headerTicket) {
    // Extraer código de formato como <TCK-1234@dominio.com>
    const match = headerTicket.match(/TCK-\d{4}/);
    if (match) return match[0];
  }

  // 2. Buscar en subject
  const subjectMatch = subject.match(/^(Re|Fwd|FW):\s*(TCK-\d{4})/i);
  if (subjectMatch) return subjectMatch[2];

  // 3. Buscar en el cuerpo del mensaje
  const bodyMatch = rawHtml.match(/Ticket:\s*(TCK-\d{4})/i);
  if (bodyMatch) return bodyMatch[1];

  return null;
}

/**
 * Busca o crea usuario (optimizado)
 */
async function findOrCreateUser(email) {
  let user = await User.findOne({ email }).lean();

  if (!user) {
    const rolesList = await List.findOne({ name: "Roles de Usuario" }).lean();
    const clientRole = rolesList?.items.find(i => i.value === "cliente");

    user = await User.create({
      name: email.split("@")[0],
      email,
      password: null,
      role: clientRole?._id,
      type: "local",
    });

    return user.toObject();
  }

  return user;
}

/**
 * Actualiza un ticket existente
 */
async function updateExistingTicket(ticketCode, userId, message, attachments, messageId) {
  // Verificar que el ticket existe y no está cerrado
  const ticket = await Ticket.findOne({
    code: ticketCode,
    status: { $nin: ["closed", "resolved"] } // Evitar actualizar tickets cerrados
  });

  if (!ticket) return null;

  // Evitar duplicados por el mismo messageId
  const existingUpdate = ticket.updates.find(u =>
    u.messageId === messageId ||
    u.message === message // Comparación adicional por si messageId no está disponible
  );

  if (existingUpdate) {
    console.log(`⚠️ Actualización duplicada detectada para ticket ${ticketCode}`);
    return null;
  }

  // Agregar la actualización
  ticket.updates.push({
    message,
    author: userId,
    attachments,
    date: new Date(),
    messageId // Guardar para evitar duplicados
  });

  ticket.updatedAt = new Date();
  await ticket.save();

  return ticket;
}

/**
 * Crea un nuevo ticket
 */
async function createNewTicket(subject, description, requester, attachments, email, messageId) {
  const [defaults, defaultAgent, sourceList] = await Promise.all([
    getDefaultLists(),
    getDefaultAgent(),
    List.findOne({ name: "Medios de Reporte" }).lean()
  ]);

  const emailSource = sourceList?.items.find(i => i.value === "email");

  const newTicket = await createTicketService({
    subject,
    description,
    requester: requester._id,
    department: defaults.department,
    priority: defaults.priority,
    impact: defaults.impact,
    type: defaults.type,
    status: defaults.status,
    source: emailSource?._id,
    assignedTo: defaultAgent?._id,
    attachments,
    messageId // Guardar para tracking
  });

  // Primer update
  newTicket.updates.push({
    message: description,
    author: requester._id,
    attachments,
    date: new Date(),
    messageId
  });

  await newTicket.save();

  // Enviar confirmación
  await sendTicketResponseEmail({
    to: email,
    ticketCode: newTicket.code,
    subject: `Tu ticket ${newTicket.code} ha sido creado`,
    message: `
      <p>Se ha creado tu ticket correctamente.</p>
      <p>Código: <strong>${newTicket.code}</strong></p>
      <p>Asunto: ${subject}</p>
      <p>Puedes responder a este correo para continuar la conversación.</p>
      <hr/>
      <div>${description}</div>
    `,
    headers: {
      "X-Ticket-ID": newTicket.code,
      "In-Reply-To": `<${newTicket.code}@tu-dominio.com>`,
      "References": `<${newTicket.code}@tu-dominio.com>`
    }
  });

  return newTicket;
}
