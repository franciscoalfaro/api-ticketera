import Ticket from "../tickets/ticket.model.js";
import { createTicketService } from "../tickets/ticket.service.js";

// Dominio permitido (opcional)
const ALLOWED_DOMAINS = ["@hotmail.cl", "@gmail.com"];

export const processIncomingMail = async (mail) => {
  try {
    const from = mail.from?.emailAddress?.address || "desconocido";
    const subject = mail.subject || "Sin asunto";
    const body = mail.body?.content || "";
    const attachments = mail.attachments || [];

    // Filtrar dominio si se desea
    if (!ALLOWED_DOMAINS.some(d => from.endsWith(d))) {
      console.log(`⚠️ Correo ignorado (dominio externo): ${from}`);
      return;
    }

    // Buscar correlativo (cabecera o asunto)
    const headers = mail.internetMessageHeaders || [];
    const headerTicket = headers.find(h => h.name === "X-Ticket-ID")?.value;
    const matchSubject = subject.match(/TCK-\d{4}/);
    const ticketCode = headerTicket || (matchSubject ? matchSubject[0] : null);

    if (ticketCode) {
      const ticket = await Ticket.findOne({ code: ticketCode });
      if (ticket) {
        ticket.description += `\n\n---\nRespuesta desde correo (${from}):\n${body}`;
        ticket.updatedAt = new Date();
        await ticket.save();
        console.log(`✉️ Ticket ${ticketCode} actualizado`);
        return;
      }
    }

    // Crear nuevo ticket
    const newTicket = await createTicketService({
      subject,
      description: body,
      reporter: null,
      department: "Sin asignar",
      type: "Incidente",
      impact: "Desconocido",
      priority: "Media",
      reportSource: "Email",
      attachments: attachments.map(a => a.name),
    });

    console.log(`🆕 Nuevo ticket creado: ${newTicket.code} desde ${from}`);
  } catch (error) {
    console.error("❌ Error al procesar correo:", error.message);
  }
};
