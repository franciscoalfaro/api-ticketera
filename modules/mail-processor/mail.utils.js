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

export const fetchSupportEmails = async () => {
  const client = await getGraphClient();
  const mailbox = process.env.SUPPORT_MAILBOX;

  const messages = await client
    .api(`/users/${mailbox}/mailFolders/Inbox/messages`)
    .filter("isRead eq false")
    .top(10)
    .get();

  console.log("📩 Correos no leídos:", messages.value.length);
  return messages.value;
};
