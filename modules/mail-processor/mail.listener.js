import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import { processIncomingMail } from "./mail.service.js";

const GRAPH_SCOPE = ["Mail.Read", "Mail.ReadBasic.All"];
let graphClient = null;

// Inicializar cliente Graph
export const initGraphClient = (accessToken) => {
  graphClient = Client.init({
    authProvider: (done) => done(null, accessToken),
  });
  return graphClient;
};

// Leer correos nuevos desde la bandeja
export const fetchUnreadEmails = async (accessToken) => {
  try {
    const client = initGraphClient(accessToken);

    const messages = await client
      .api("/me/mailFolders/Inbox/messages")
      .filter("isRead eq false")
      .top(10)
      .get();

    if (!messages.value.length) {
      console.log("📭 No hay correos nuevos.");
      return;
    }

    for (const msg of messages.value) {
      await processIncomingMail(msg);
      // Marcar como leído para no volver a procesar
      await client.api(`/me/messages/${msg.id}`).update({ isRead: true });
    }
  } catch (err) {
    console.error("❌ Error al obtener correos:", err.message);
  }
};
