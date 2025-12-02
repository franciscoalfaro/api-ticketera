import { fetchSupportEmails, markAsRead } from "./mail.utils.js";
import { processIncomingMail } from "./mail.service.js";

export const processUnreadEmails = async () => {
  try {
    const mails = await fetchSupportEmails();

    if (!mails.length) {
      console.log("📭 No hay correos nuevos.");
      return;
    }

    for (const mail of mails) {
      await processIncomingMail(mail);
      await markAsRead(mail.id);
    }

  } catch (err) {
    console.error("❌ Error al leer correos:", err.message);
  }
};
