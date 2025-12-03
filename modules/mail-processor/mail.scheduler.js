import cron from "node-cron";
import { processIncomingEmails } from "./mail.service.js";

cron.schedule("* * * * *", async () => {
  try {
    await processIncomingEmails();
  } catch (err) {
    console.error("Error procesando correos:", err);
  }
});
