// modules/mail-processor/mail.utils.js

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import fs from "fs";
import path from "path";
import "isomorphic-fetch";

// =====================================================
// 🔹 CLIENTE GRAPH
// =====================================================

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET
);

const urlFront = process.env.FRONTEND_URL || "http://localhost:3012";

export const getGraphClient = async () => {
  const token = await credential.getToken(
    "https://graph.microsoft.com/.default"
  );

  return Client.init({
    authProvider: (done) => done(null, token.token),
  });
};

// =====================================================
// 📥 1. LEER CORREOS + ATTACHMENTS (INLINE + NORMALES)
// =====================================================

export const fetchSupportEmails = async () => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  const response = await client
    .api(`/users/${mailbox}/mailFolders/Inbox/messages`)
    .expand("attachments")
    .select(
      "subject,body,from,receivedDateTime,internetMessageHeaders,attachments"
    )
    .filter("isRead eq false")
    .orderby("receivedDateTime DESC")
    .top(20)
    .get();

  return response.value;
};

// =====================================================
// 📂 CONFIGURACIÓN CARPETAS
// =====================================================

const INLINE_DIR = path.resolve("uploads/inline");
const ATTACH_DIR = path.resolve("uploads/attachments");

for (const dir of [INLINE_DIR, ATTACH_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// =====================================================
// 🟦 2A. PROCESAR IMÁGENES INLINE (cid:xxxx)
// =====================================================

export const processInlineImages = async (attachments = []) => {
  const cidMap = {};

  for (const att of attachments) {
    if (
      att.isInline &&
      att.contentBytes &&
      att.name &&
      (att.contentType?.startsWith("image/") ||
        att["@odata.type"]?.includes("fileAttachment"))
    ) {
      const filename = `${Date.now()}-${att.name}`;
      const filePath = path.join(INLINE_DIR, filename);

      fs.writeFileSync(filePath, Buffer.from(att.contentBytes, "base64"));

      // Mapa para reemplazar el cid en el HTML
      cidMap[att.contentId] = `${urlFront}/uploads/inline/${filename}`;
    }
  }

  return cidMap;
};

/**
 * Reemplazar cid:xxxxx en el HTML
 */
export const replaceCidImages = (html, cidMap) => {
  let result = html;

  for (const cid in cidMap) {
    result = result.replaceAll(`cid:${cid}`, cidMap[cid]);
  }

  return result;
};

// =====================================================
// 🟥 2B. PROCESAR ADJUNTOS NORMALES (PDF, DOCX, ZIP, IMG)
// =====================================================

export const processRegularAttachments = async (attachments = []) => {
  const files = [];

  for (const att of attachments) {
    // Solo adjuntos NO inline
    if (att.isInline || !att.contentBytes) continue;

    const filename = `${Date.now()}-${att.name}`;
    const filePath = path.join(ATTACH_DIR, filename);

    fs.writeFileSync(filePath, Buffer.from(att.contentBytes, "base64"));

    files.push({
      name: att.name,
      filename,
      url: `/uploads/attachments/${filename}`,
      contentType: att.contentType,
      size: att.size || null,
    });
  }

  return files;
};

// =====================================================
// ✔ 3. MARCAR CORREO COMO LEÍDO
// =====================================================

export const markAsRead = async (messageId) => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  await client.api(`/users/${mailbox}/messages/${messageId}`).update({
    isRead: true,
  });
};

// =====================================================
// 📤 4. ENVIAR RESPUESTA (CON CORRELATIVO)
// =====================================================

export const sendTicketResponseEmail = async ({
  to,
  ticketCode,
  subject,
  message,
}) => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  // =============================
  //  HTML FINAL DEL CORREO
  // =============================
  const htmlContent = `
  <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f7; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e2e2;">
      <!-- HEADER -->
      <tr>
        <td style="background: #111827; padding: 25px 20px; text-align: center;">
          <img src="https://franciscoalfaro.cl/logo.png" alt="Logo" style="width: 120px; margin-bottom: 8px;" />
          <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Ticketera - Sistema de Soporte</h2>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding: 30px 35px; color: #333333;">
          <h2 style="margin-top: 0; color: #111827;">✔ Ticket creado correctamente</h2>

          <p>Hola,</p>
          <p>Tu solicitud ha sido registrada exitosamente en nuestro sistema de soporte.</p>

          <div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #2563eb; margin: 25px 0; border-radius: 6px;">
            <p style="margin: 0;"><strong>Código del Ticket:</strong> <span style="color: #2563eb; font-weight: bold;">${ticketCode}</span></p>
            <p style="margin: 6px 0 0;"><strong>Asunto:</strong> ${subject}</p>
          </div>

          <h3 style="margin-bottom: 8px; color: #111827;">📄 Descripción enviada</h3>
          <div style="padding: 15px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${message}
          </div>

          <p style="margin-top: 20px;">
            Puedes responder directamente a este correo para continuar con el seguimiento del ticket.
          </p>

          <hr style="border: none; height: 1px; background: #e5e7eb; margin: 30px 0;" />

          <p style="font-size: 14px; color: #555;">
            Atentamente,<br />
            <strong>Equipo de Soporte</strong><br />
            Ticketera • franciscoalfaro.cl
          </p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background: #111827; padding: 15px; text-align: center;">
          <p style="color: #ffffff; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Ticketera — Todos los derechos reservados.
          </p>
        </td>
      </tr>
    </table>
  </div>
  `;

  // =============================
  // 🔥 ENVÍO REAL DEL CORREO
  // =============================
  await client.api(`/users/${mailbox}/sendMail`).post({
    message: {
      subject: `[${ticketCode}] ${subject || "Ticket creado"}`,
      body: {
        contentType: "HTML",
        content: htmlContent, // 👈 ESTE ES EL CORRECTO
      },
      toRecipients: [{ emailAddress: { address: to } }],
      from: { emailAddress: { address: mailbox } },
      internetMessageHeaders: [
        { name: "X-Ticket-ID", value: ticketCode },
      ],
    },
    saveToSentItems: true,
  });

  console.log(`📨 Respuesta enviada a ${to} por ticket ${ticketCode}`);
};

