// modules/mail-processor/mail.utils.js
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import "isomorphic-fetch";

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET
);

export const getGraphClient = async () => {
  const token = await credential.getToken("https://graph.microsoft.com/.default");

  return Client.init({
    authProvider: (done) => done(null, token.token),
  });
};

// ==========================
// 🔹 Leer bandeja soporte
// ==========================
export const fetchSupportEmails = async () => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  const response = await client
    .api(`/users/${mailbox}/mailFolders/Inbox/messages`)
    .filter("isRead eq false")
    .orderby("receivedDateTime DESC")
    .top(10)
    .get();

  return response.value;
};

// ==========================
// 🔹 Marcar correo como leído
// ==========================
export const markAsRead = async (messageId) => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  await client.api(`/users/${mailbox}/messages/${messageId}`).update({
    isRead: true,
  });
};

// ==========================
// 🔹 Enviar respuesta automática
// ==========================
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
      subject: subject || `Ticket creado correctamente (${ticketCode})`,
      body: {
        contentType: "HTML",
        content: `
          <p>Hola,</p>
          <p>Tu ticket ha sido registrado correctamente.</p>
          <p><strong>Código del Ticket:</strong> ${ticketCode}</p>
          <p><strong>Descripción:</strong> ${message}</p>
          <br>
          <hr>
          <p>Saludos,<br>Equipo de Soporte</p>
        `,
      },
      toRecipients: [
        {
          emailAddress: { address: to },
        },
      ],
      from: {
        emailAddress: { address: mailbox },
      },
    },
    saveToSentItems: true,
  };

  await client.api(`/users/${mailbox}/sendMail`).post(email);
  console.log(`📨 Respuesta enviada a ${to} por ticket ${ticketCode}`);
};
