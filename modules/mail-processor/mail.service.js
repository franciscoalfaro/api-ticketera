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

    if (!from) return;

    if (!ALLOWED_DOMAINS.some((d) => from.endsWith(d))) {
      console.log(`⚠️ Correo ignorado: ${from}`);
      return;
    }

    // 1. Procesar imágenes inline (cid)
    const cidMap = await processInlineImages(attachments);
    const processedHtml = replaceCidImages(rawHtml, cidMap);

    // 2. Procesar adjuntos normales
    const regularFiles = await processRegularAttachments(attachments);

    // 3. Detectar correlativo
    const headers = mail.internetMessageHeaders || [];
    const headerTicket = headers.find((h) => h.name === "X-Ticket-ID")?.value;
    const matchSubject = subject.match(/TCK-\d{4}/);

    const ticketCode = headerTicket || (matchSubject ? matchSubject[0] : null);

    // =====================================================
    // 🔹 4. SI EXISTE TICKET → ACTUALIZAR
    // =====================================================
    if (ticketCode) {
      const ticket = await Ticket.findOne({ code: ticketCode });

      if (ticket) {

        // Buscar autor
        let requester = await User.findOne({ email: from }).lean();

        if (!requester) {
          const newUser = await User.create({
            name: from.split("@")[0],
            email: from,
            password: null,
            type: "local",
          });
          requester = newUser.toObject();
        }

        // Registrar update
        ticket.updates.push({
          message: processedHtml,
          author: requester._id,
          attachments: regularFiles,
          date: new Date(),
        });

        ticket.updatedAt = new Date();
        await ticket.save();

        console.log(`✉️ Ticket ${ticketCode} actualizado`);
        ticket.isUpdate = true;
        return ticket;
      }
    }

    // =====================================================
    // 🔹 5. SI NO EXISTE → CREAR TICKET NUEVO
    // =====================================================
    const defaults = await getDefaultLists();
    const defaultAgent = await getDefaultAgent();

    let requester = await User.findOne({ email: from }).lean();

    if (!requester) {
      const rolesList = await List.findOne({ name: "Roles de Usuario" }).lean();
      const clientRole = rolesList.items.find((i) => i.value === "cliente");

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
    const emailSource = sourceList.items.find((i) => i.value === "email");

    const newTicket = await createTicketService({
      subject,
      description: processedHtml,
      requester: requester._id,
      department: defaults.department,
      priority: defaults.priority,
      impact: defaults.impact,
      type: defaults.type,
      status: defaults.status,
      source: emailSource._id,
      assignedTo: defaultAgent ? defaultAgent._id : null,
      attachments: regularFiles,
    });

    // Primer update
    newTicket.updates.push({
      message: processedHtml,
      author: requester._id,
      attachments: regularFiles,
      date: new Date(),
    });

    await newTicket.save();

    console.log(`🎫 Ticket creado: ${newTicket.code}`);

    await sendTicketResponseEmail({
      to: from,
      ticketCode: newTicket.code,
      subject,
      message: `
        Se ha creado tu ticket correctamente.<br/>
        Puedes responder a este correo para continuar la conversación.<br/><br/>
        <b>Resumen:</b><br/>
        ${processedHtml}
      `,
    });

    newTicket.isUpdate = false;
    return newTicket;

  } catch (error) {
    console.error("❌ Error procesando correo:", error);
  }
};


// =====================================================
// 🔹 PROCESAR TODOS LOS CORREOS
// =====================================================
export const processIncomingEmails = async () => {
  const emails = await fetchSupportEmails();

  for (const mail of emails) {
    const ticket = await processIncomingMail(mail);

    if (ticket && !ticket.isUpdate) {
      await sendTicketResponseEmail({
        to: mail.from.emailAddress.address,
        ticketCode: ticket.code,
        subject: "Tu ticket ha sido creado",
        message: ticket.description,
      });
    }

    await markAsRead(mail.id);
  }
};
