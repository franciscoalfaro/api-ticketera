import Ticket from "../tickets/ticket.model.js";
import User from "../users/user.model.js";
import List from "../list/list.model.js";
import { createTicketService, getDefaultAgent, getDefaultLists } from "../tickets/ticket.service.js";

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

    // ==========================
    // 🔹 Verificar correlativo del ticket
    // ==========================
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

    // ==========================
    // 🔹 Cargar valores por defecto
    // ==========================
    const defaults = await getDefaultLists();
    const defaultAgent = await getDefaultAgent();

    if (!defaults.department || !defaults.priority || !defaults.impact || !defaults.status) {
      console.log("Error: No se pudieron cargar los defaults desde las listas.");
      return;
    }

    // ==========================
    // 🔹 Buscar requester por email
    // ==========================
    let requester = await User.findOne({ email: from }).lean();

    // ==========================
    // 🔹 Si no existe, crear usuario CLIENTE (local, sin clave)
    // ==========================
    if (!requester) {
      console.log(`Creando usuario Cliente LOCAL para: ${from}`);

      const rolesList = await List.findOne({ name: "Roles de Usuario" }).lean();
      const clientRole = rolesList?.items?.find(r => r.value === "cliente");

      if (!clientRole) {
        console.log("No existe el rol Cliente en la lista Roles de Usuario.");
        return;
      }

      const newUser = await User.create({
        name: from.split("@")[0], 
        email: from,
        password: null,           
        role: clientRole._id,     
        area: null,
        type: "local",           
        isDeleted: false
      });

      requester = newUser.toObject();
    }

    // ==========================
    // 🔹 Crear ticket nuevo
    // ==========================

    //se debe de buscar el source este corresponde el metodo de ingreso del ticket que en este caso es por email

    const sourceList = await List.findOne({ name: "Medios de Reporte" }).lean();
    const emailSource = sourceList?.items?.find(item => item.value === "email");

    if (!emailSource) {
      console.log("No existe 'Email' en Medios de Reporte");
      return;
    }
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
      attachments: attachments.map(a => a.name),
    });

    console.log(`Nuevo ticket creado: ${newTicket.code} desde ${from}`);

  } catch (error) {
    console.error("Error al procesar correo:", error.message);
  }
};
