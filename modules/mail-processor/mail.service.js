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
import { resolveTicketClassificationFromEmail } from "../ai-ticket/ai-ticket.service.js";

const ALLOWED_DOMAINS = ["@hotmail.cl", "@gmail.com", "@franciscoalfaro.cl"];

// =====================================================
// 🔹 FUNCIÓN PARA DETECTAR REBOTES DE CORREO
// =====================================================
const isBounceEmail = (headers, from, subject, html) => {
  // Headers típicos de rebotes/NDR (Non-Delivery Reports)
  const bounceHeaderPatterns = [
    'X-Failed-Recipients',
    'X-Mailer.*Mail Delivery System',
    'X-Autoreply',
    'X-Autoreply-From',
    'List-Unsubscribe',
    'Precedence.*bulk',
    'Precedence.*auto_reply'
  ];

  // Remitentes típicos de rebotes
  const bounceFromPatterns = [
    'mailer-daemon',
    'postmaster',
    'noreply',
    'no-reply',
    'donotreply',
    'do-not-reply',
    'system.*reply',
    'automated.*message',
    'failure.*notice',
    'undeliverable',
    'delivery.*status.*notification'
  ];

  // Asuntos típicos de rebotes
  const bounceSubjectPatterns = [
    'Undeliverable:',
    'Delivery Status Notification',
    'Mail Delivery Failed',
    'Returned mail:',
    'Failure Notice',
    'Delivery failure',
    'Unable to deliver',
    'Message rejection',
    'Return notice',
    'Bounceback'
  ];

  // 1. Verificar headers
  const hasBouncheHeader = headers.some(h => 
    bounceHeaderPatterns.some(pattern => 
      new RegExp(pattern, 'i').test(h.name)
    )
  );

  // 2. Verificar remitente
  const hasFromBounce = bounceFromPatterns.some(pattern =>
    new RegExp(pattern, 'i').test(from)
  );

  // 3. Verificar asunto
  const hasSubjectBounce = bounceSubjectPatterns.some(pattern =>
    new RegExp(pattern, 'i').test(subject)
  );

  // 4. Verificar contenido del cuerpo (errores de entrega)
  const bounceBodyPatterns = [
    'delivery failed',
    'undeliverable',
    'mail delivery failed',
    'could not be delivered',
    'failed to deliver',
    'delivery was unsuccessful',
    'rejected by',
    'bounce',
    'did not reach the following recipient',
    'error.*recipient',
    'invalid recipient',
    'unknown user'
  ];

  const hasBodyBounce = bounceBodyPatterns.some(pattern =>
    new RegExp(pattern, 'i').test(html)
  );

  return hasBouncheHeader || hasFromBounce || hasSubjectBounce || hasBodyBounce;
};

// =====================================================
// 🔹 FUNCIÓN PARA DETECTAR SI ES CORREO DEL SISTEMA
// =====================================================
const isSystemEmail = (headers, from, subject, html) => {
  const SUPPORT_MAILBOX = process.env.SUPPORT_MAILBOX;
  
  // 1. Verificar por header específico
  const ticketeraSource = headers.find((h) => 
    h.name === "X-Ticketera-Source" && h.value === "system"
  );
  
  // 2. Verificar si viene del mismo mailbox de soporte
  if (from === SUPPORT_MAILBOX) return true;
  
  // 3. Verificar contenido típico de correos del sistema
  const systemIndicators = [
    'Ticket creado correctamente',
    'Se ha creado tu ticket',
    'Tu solicitud ha sido registrada',
    'Puedes responder directamente a este correo',
    'Equipo de Soporte<br />Ticketera'
  ];
  
  const hasSystemContent = systemIndicators.some(text => 
    html.includes(text) || subject.includes(text)
  );
  
  return ticketeraSource || hasSystemContent;
};

// =====================================================
// 🔹 FUNCIÓN PARA LIMPIAR ASUNTO
// =====================================================
const cleanSubject = (subject) => {
  if (!subject) return "Sin asunto";
  
  // Eliminar prefijos comunes
  let clean = subject
    .replace(/^(Re:|RE:|Fwd:|FW:|R:|Rsp:|Respuesta:|Respuesta al:)\s*/gi, '')
    .trim();
  
  // Eliminar código de ticket del asunto si está al inicio
  clean = clean.replace(/^\[TCK-\d{4}\]\s*/, '');
  
  return clean || subject;
};

// =====================================================
// 🔹 FUNCIÓN PARA VERIFICAR UPDATE DUPLICADO
// =====================================================
const isDuplicateUpdate = (ticket, newMessage) => {
  if (!ticket.updates || ticket.updates.length === 0) return false;
  
  const lastUpdate = ticket.updates[ticket.updates.length - 1];
  const timeDiff = new Date() - new Date(lastUpdate.date);
  
  // Si el último update fue hace menos de 5 minutos
  if (timeDiff < 300000) { // 5 minutos
    // Extraer el primer párrafo o 100 caracteres para comparar
    const lastMsg = lastUpdate.message.substring(0, 200);
    const newMsg = newMessage.substring(0, 200);
    
    // Si son muy similares, es probablemente un duplicado
    if (lastMsg === newMsg) {
      return true;
    }
  }
  
  return false;
};

// =====================================================
// 🔹 PROCESAR UN SOLO CORREO (MODIFICADO)
// =====================================================
export const processIncomingMail = async (mail) => {
  try {
    const from = mail.from?.emailAddress?.address || null;
    const originalSubject = mail.subject || "Sin asunto";
    const rawHtml = mail.body?.content || "";
    const attachments = mail.attachments || [];
    const headers = mail.internetMessageHeaders || [];

    if (!from) {
      console.log("❌ Correo sin remitente");
      return null;
    }

    const SUPPORT_MAILBOX = process.env.SUPPORT_MAILBOX;
    
    // 🔥 FILTRAR REBOTES DE CORREO
    if (isBounceEmail(headers, from, originalSubject, rawHtml)) {
      console.log(`⚠️ Rebote de correo ignorado: ${cleanSubject(originalSubject).substring(0, 50)}... desde ${from}`);
      
      // Marcar como leído inmediatamente para que no sea procesado de nuevo
      try {
        await markAsRead(mail.id);
      } catch (error) {
        console.warn("⚠️ No se pudo marcar rebote como leído:", error.message);
      }
      
      return {
        success: false,
        message: "Rebote de correo ignorado",
        action: "bounce_ignored",
        from
      };
    }
    
    // 🔥 FILTRAR CORREOS DEL SISTEMA
    if (isSystemEmail(headers, from, originalSubject, rawHtml)) {
      console.log(`🚫 Correo del sistema ignorado: ${cleanSubject(originalSubject).substring(0, 50)}...`);
      
      // Marcar como leído inmediatamente para que no sea procesado de nuevo
      try {
        await markAsRead(mail.id);
      } catch (error) {
        console.warn("⚠️ No se pudo marcar correo del sistema como leído:", error.message);
      }
      
      return null;
    }

    if (!ALLOWED_DOMAINS.some((d) => from.endsWith(d))) {
      console.log(`⚠️ Correo ignorado (dominio no permitido): ${from}`);
      return null;
    }

    // 1. Procesar imágenes inline (cid)
    const cidMap = await processInlineImages(attachments);
    const processedHtml = replaceCidImages(rawHtml, cidMap);

    // 2. Procesar adjuntos normales
    const regularFiles = await processRegularAttachments(attachments);

    // 3. Detectar correlativo
    const headerTicket = headers.find((h) => h.name === "X-Ticket-ID")?.value;
    const matchSubject = originalSubject.match(/TCK-\d{4}/);

    const ticketCode = headerTicket || (matchSubject ? matchSubject[0] : null);
    const cleanSubjectText = cleanSubject(originalSubject);

    // =====================================================
    // 🔹 4. SI EXISTE TICKET → ACTUALIZAR
    // =====================================================
    if (ticketCode) {
      const ticket = await Ticket.findOne({ code: ticketCode });

      if (ticket) {
        // 🔥 VERIFICAR SI ES UN UPDATE DUPLICADO
        if (isDuplicateUpdate(ticket, processedHtml)) {
          console.log(`⚠️ Update duplicado ignorado para ${ticketCode}`);
          
          // Marcar como leído de todos modos
          try {
            await markAsRead(mail.id);
          } catch (error) {
            console.warn("⚠️ No se pudo marcar correo como leído:", error.message);
          }
          
          return {
            success: false,
            message: "Update duplicado",
            ticketCode,
            action: "ignored"
          };
        }

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
          source: "email"
        });

        ticket.updatedAt = new Date();
        await ticket.save();

        await generateDailyReport();

        console.log(`✉️ Ticket ${ticketCode} actualizado desde email`);
        
        // NO ENVIAR CORREO DE RESPUESTA AQUÍ
        // El agente responderá desde el front si es necesario
        
        return {
          success: true,
          ticket,
          ticketCode,
          action: "updated",
          from,
          message: "Ticket actualizado"
        };
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

    const {
      resolvedPriority,
      resolvedImpact,
      resolvedDepartment,
      resolvedType,
      aiResult,
    } = await resolveTicketClassificationFromEmail({
      subject: cleanSubjectText,
      html: processedHtml,
      defaults,
    });

    if (aiResult.enabled) {
      if (aiResult.applied) {
        console.log(`🤖 Clasificación IA aplicada (confianza ${aiResult.classification?.confidence ?? 0})`);
      } else {
        console.log(`🤖 IA no aplicada: ${aiResult.reason || "sin razón"}`);
      }
    }

    const newTicket = await createTicketService({
      subject: cleanSubjectText,
      description: processedHtml,
      requester: requester._id,
      department: resolvedDepartment,
      priority: resolvedPriority,
      impact: resolvedImpact,
      type: resolvedType,
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
      source: "email"
    });

    await newTicket.save();

    console.log(`🎫 Ticket creado desde email: ${newTicket.code}`);

    // 🔥 ENVIAR CORREO DE CONFIRMACIÓN CON DELAY
    // Esto evita que el correo de confirmación sea procesado inmediatamente
    setTimeout(async () => {
      try {
        await sendTicketResponseEmail({
          to: from,
          ticketCode: newTicket.code,
          subject: cleanSubjectText,
          message: `
            Se ha creado tu ticket correctamente.<br/>
            Puedes responder a este correo para continuar la conversación.<br/><br/>
            <b>Resumen:</b><br/>
            ${processedHtml}
          `,
        });
        console.log(`✅ Correo de confirmación enviado para ${newTicket.code}`);
      } catch (error) {
        console.error(`❌ Error enviando correo de confirmación para ${newTicket.code}:`, error);
      }
    }, 15000); // 15 segundos de delay

    await generateDailyReport();
    
    return {
      success: true,
      ticket: newTicket,
      ticketCode: newTicket.code,
      action: "created",
      from,
      message: "Ticket creado"
    };

  } catch (error) {
    console.error("❌ Error procesando correo:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =====================================================
// 🔹 PROCESAR TODOS LOS CORREOS (MODIFICADO)
// =====================================================
export const processIncomingEmails = async () => {
  try {
    const emails = await fetchSupportEmails();
    console.log(`📨 Encontrados ${emails.length} correos nuevos`);

    const results = [];
    let createdCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;
    let bounceCount = 0;

    for (const mail of emails) {
      console.log(`📧 Procesando: ${mail.subject?.substring(0, 50)}...`);
      
      const result = await processIncomingMail(mail);
      
      if (result) {
        results.push(result);
        
        if (result.action === "created") {
          createdCount++;
        } else if (result.action === "updated") {
          updatedCount++;
        } else if (result.action === "ignored") {
          ignoredCount++;
        } else if (result.action === "bounce_ignored") {
          bounceCount++;
        }
      }
      
      // Solo marcar como leído si no es un correo del sistema
      // (los correos del sistema y rebotes ya se marcan como leídos en processIncomingMail)
      if (result && result.action !== "ignored" && result.action !== "bounce_ignored") {
        try {
          await markAsRead(mail.id);
        } catch (error) {
          console.warn(`⚠️ No se pudo marcar correo como leído:`, error.message);
        }
      }
      
      // Pequeña pausa entre correos para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Resultados: ${createdCount} creados, ${updatedCount} actualizados, ${ignoredCount} ignorados, ${bounceCount} rebotes`);
    
    return {
      success: true,
      stats: {
        total: emails.length,
        created: createdCount,
        updated: updatedCount,
        ignored: ignoredCount,
        bounces: bounceCount
      },
      results
    };
    
  } catch (error) {
    console.error("❌ Error procesando correos:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =====================================================
// 🔹 FUNCIÓN PARA ENVIAR RESPUESTA DESDE FRONTEND
// =====================================================
export const sendTicketReplyFromFrontend = async ({
  ticketId,
  message,
  authorId,
  attachments = [],
  sendEmail = true
}) => {
  try {
    const ticket = await Ticket.findById(ticketId)
      .populate('requester', 'email name')
      .populate('assignedTo', 'email name');

    if (!ticket) {
      throw new Error('Ticket no encontrado');
    }

    const author = await User.findById(authorId);
    if (!author) {
      throw new Error('Autor no encontrado');
    }

    // 1. Agregar la actualización a la bitácora
    const updateData = {
      message,
      author: authorId,
      attachments,
      date: new Date(),
      source: 'web',
      type: 'agent_reply'
    };

    ticket.updates.push(updateData);
    ticket.updatedAt = new Date();
    
    // Si el ticket no tenía asignado, asignar al autor
    if (!ticket.assignedTo && authorId) {
      ticket.assignedTo = authorId;
    }
    
    await ticket.save();

    // 2. Enviar correo al usuario si está configurado
    if (sendEmail && ticket.requester?.email) {
      await sendTicketResponseEmail({
        to: ticket.requester.email,
        ticketCode: ticket.code,
        subject: ticket.subject,
        message: message,
      });
    }

    // 3. Registrar en el reporte diario
    await generateDailyReport();

    return {
      success: true,
      ticket: ticket,
      update: updateData,
      message: 'Actualización agregada y correo enviado'
    };
    
  } catch (error) {
    console.error('❌ Error en sendTicketReplyFromFrontend:', error);
    throw error;
  }
};