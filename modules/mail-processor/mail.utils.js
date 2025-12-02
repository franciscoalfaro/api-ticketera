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

// Leer bandeja del correo soporte
export const fetchSupportEmails = async () => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX; // soporte@tudominio.cl

  const response = await client
    .api(`/users/${mailbox}/mailFolders/Inbox/messages`)
    .filter("isRead eq false")
    .orderby("receivedDateTime DESC")
    .top(10)
    .get();

  return response.value;
};

// Marcar correo como leído
export const markAsRead = async (messageId) => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  await client
    .api(`/users/${mailbox}/messages/${messageId}`)
    .update({ isRead: true });
};
