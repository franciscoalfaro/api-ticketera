
import { processUnreadEmails } from "./mail.listener.js";

export const obtenerMails = async (req, res) => {
  try {
    const lists = await processUnreadEmails();
    res.status(200).json({ status: "success", lists });
  } catch (error) {
    console.error("Error al obtener listas:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};