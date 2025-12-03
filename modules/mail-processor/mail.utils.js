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

  const email = {
    message: {
      subject: `[${ticketCode}] ${subject || "Ticket creado"}`,
      body: {
        contentType: "HTML",
        content: `
          <p>Hola,</p>
          <p>Tu ticket ha sido registrado correctamente.</p>
          <p><strong>Código del Ticket:</strong> ${ticketCode}</p>
          <p>${message}</p>
          <hr/>
          <p><em>Responde este correo para continuar con el seguimiento.</em></p>
        `,
      },
      toRecipients: [{ emailAddress: { address: to } }],
      from: { emailAddress: { address: mailbox } },

      // 🔥 Cabecera especial para correlativo
      internetMessageHeaders: [
        { name: "X-Ticket-ID", value: ticketCode },
      ],
    },
    saveToSentItems: true,
  };

  await client.api(`/users/${mailbox}/sendMail`).post(email);

  console.log(`📨 Respuesta enviada a ${to} por ticket ${ticketCode}`);
};
