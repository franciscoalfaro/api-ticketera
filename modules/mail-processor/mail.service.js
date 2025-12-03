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
} from "./mail.utils.js";

const ALLOWED_DOMAINS = ["@hotmail.cl", "@gmail.com", "@franciscoalfaro.cl"];

// =====================================================
// 🔹 PROCESAR UN SOLO CORREO
// =====================================================
export const processIncomingMail = async (mail) => {
  try {
    const from = mail.from?.emailAddress?.address || null;
    const subject = mail.subject || "Sin asunto";
    const body = mail.body?.content || "";
    const attachments = mail.attachments || [];

    if (!from) return;

    if (!ALLOWED_DOMAINS.some((d) => from.endsWith(d))) {
      console.log(`⚠️ Correo ignorado: ${from}`);
      return;
    }

    // Verificar correlativo en headers
    const headers = mail.internetMessageHeaders || [];
    const headerTicket = headers.find((h) => h.name === "X-Ticket-ID")?.value;
    const matchSubject = subject.match(/TCK-\d{4}/);
    const ticketCode = headerTicket || (matchSubject ? matchSubject[0] : null);

    // =======================
    // 🔹 Actualizar ticket
    // =======================
    if (ticketCode) {
      const ticket = await Ticket.findOne({ code: ticketCode });

      if (ticket) {
        ticket.description += `\n\n---\nRespuesta de ${from}:\n${body}`;
        ticket.updatedAt = new Date();
        await ticket.save();

        console.log(`✉️ Ticket ${ticketCode} actualizado`);
        return ticket;
      }
    }

    // =======================
    // 🔹 Crear ticket nuevo
    // =======================
    const defaults = await getDefaultLists();
    const defaultAgent = await getDefaultAgent();

    let requester = await User.findOne({ email: from }).lean();

    if (!requester) {
      const rolesList = await List.findOne({ name: "Roles de Usuario" }).lean();
      const clientRole = rolesList?.items?.find((r) => r.value === "cliente");

      const newUser = await User.create({
        name: from.split("@")[0],
        email: from,
        password: null,
        role: clientRole._id,
        type: "local",
      });

      requester = newUser.toObject();
    }

    const sourceList = await List.findOne({ name: "Medios de Reporte" }).lean();
    const emailSource = sourceList?.items?.find((i) => i.value === "email");

    const newTicket = await createTicketService({
      subject,
      description: body,
      requester: requester._id,
      department: defaults.department,
      priority: defaults.priority,
      impact: defaults.impact,
      type: defaults.type,
      status: defaults.status,
      source: emailSource._id,
      assignedTo: defaultAgent ? defaultAgent._id : null,
      attachments: attachments.map((a) => a.name),
    });

    console.log(`🎫 Ticket creado: ${newTicket.code}`);

    return newTicket;
  } catch (error) {
    console.error("Error procesando correo:", error);
  }
};

// =====================================================
// 🔹 Procesar TODOS los correos no leídos
// =====================================================
export const processIncomingEmails = async () => {
  const emails = await fetchSupportEmails();

  for (const mail of emails) {
    const ticket = await processIncomingMail(mail);

    if (ticket) {
      // Enviar respuesta automática solo SI es ticket nuevo
      if (!ticket.isUpdate) {
        await sendTicketResponseEmail({
          to: mail.from.emailAddress.address,
          ticketCode: ticket.code,
          subject: "Tu ticket ha sido creado",
          message: ticket.description,
        });
      }
    }

    await markAsRead(mail.id);
  }
};
