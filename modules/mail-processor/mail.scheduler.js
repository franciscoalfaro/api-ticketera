import { processIncomingEmails } from "./mail.service.js";

setInterval(() => {
  processIncomingEmails().catch(err => console.error("Error procesando correos:", err));
}, 60 * 1000); // cada 1 minuto
