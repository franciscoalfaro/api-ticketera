import Ticket from "../tickets/ticket.model.js";
import { createTicketService,getDefaultAgent,getDefaultLists } from "../tickets/ticket.service.js";

const ALLOWED_DOMAINS = ["@hotmail.cl", "@gmail.com", "@franciscoalfaro.cl"];

export const processIncomingMail = async (mail) => {
  try {
    const from = mail.from?.emailAddress?.address || null;
    const subject = mail.subject || "Sin asunto";
    const body = mail.body?.content || "";
    const attachments = mail.attachments || [];

    if (!from) return;

    if (!ALLOWED_DOMAINS.some(d => from.endsWith(d))) {
      console.log(`⚠️ Correo ignorado (dominio externo): ${from}`);
      return;
    }

    // 🟦 Buscar ticket existente por correlativo
    const headers = mail.internetMessageHeaders || [];
    const headerTicket = headers.find(h => h.name === "X-Ticket-ID")?.value;
    const matchSubject = subject.match(/TCK-\d{4}/);
    const ticketCode = headerTicket || (matchSubject ? matchSubject[0] : null);

    if (ticketCode) {
      const ticket = await Ticket.findOne({ code: ticketCode });
      if (ticket) {
        ticket.description += `\n\n---\nRespuesta de ${from}:\n${body}`;
        ticket.updatedAt = new Date();
        await ticket.save();
        console.log(`✉️ Ticket ${ticketCode} actualizado`);
        return;
      }
    }

    // 🟦 Obtener defaults dinámicos desde la BD
    const defaults = await getDefaultLists();
    const defaultAgent = await getDefaultAgent();

    if (!defaults.department || !defaults.priority || !defaults.impact || !defaults.status) {
      console.log("❌ No se pudieron cargar valores por defecto desde List.");
      return;
    }

    // 🟦 Crear ticket nuevo
    const newTicket = await createTicketService({
      subject,
      description: body,
      requester: from,
      department: defaults.department,
      priority: defaults.priority,
      impact: defaults.impact,
      type: defaults.type,
      status: defaults.status,
      source: "Email",
      assignedTo: defaultAgent ? defaultAgent._id : null,
      attachments: attachments.map(a => a.name),
    });

    console.log(`🆕 Nuevo ticket creado: ${newTicket.code} desde ${from}`);

  } catch (error) {
    console.error("❌ Error al procesar correo:", error.message);
  }
};
