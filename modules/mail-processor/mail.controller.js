
import { processUnreadEmails } from "./mail.listener.js";
import { createLog } from "../logs/logs.service.js";

export const obtenerMails = async (req, res) => {
  try {
    const lists = await processUnreadEmails();
    await createLog({
      user: req.user?.id,
      action: "PROCESAR_CORREOS",
      module: "mail-processor",
      description: "Procesamiento manual de correos ejecutado",
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(200).json({ status: "success", lists });
  } catch (error) {
    console.error("Error al obtener listas:", error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_PROCESAR_CORREOS",
      module: "mail-processor",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};