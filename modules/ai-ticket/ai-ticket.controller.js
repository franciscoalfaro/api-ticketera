import { createLog } from "../logs/logs.service.js";
import { classifyEmailForCatalog } from "./ai-ticket.service.js";

export const classifyEmailPreview = async (req, res) => {
  try {
    const { subject = "", html = "" } = req.body || {};

    if (!subject && !html) {
      return res.status(400).json({
        status: "error",
        message: "Debes enviar subject o html para clasificar",
      });
    }

    const result = await classifyEmailForCatalog({ subject, html });

    await createLog({
      user: req.user?.id,
      action: "CLASIFICAR_EMAIL_IA",
      module: "ai-ticket",
      description: `Clasificación IA ejecutada (applied=${result.aiResult?.applied ? "si" : "no"})`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    return res.json({
      status: "success",
      result,
      message: "Clasificación IA ejecutada",
    });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_CLASIFICAR_EMAIL_IA",
      module: "ai-ticket",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });

    return res.status(500).json({
      status: "error",
      message: error.message || "Error al clasificar email",
    });
  }
};

export const aiClassifierStatus = async (req, res) => {
  return res.json({
    status: "success",
    ai: {
      enabled: ["1", "true", "yes", "on"].includes(String(process.env.AI_TICKET_CLASSIFIER_ENABLED || "").toLowerCase()),
      provider: "ollama",
      model: process.env.AI_OLLAMA_MODEL || "qwen2.5:14b-instruct",
      baseUrl: process.env.AI_OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    },
  });
};

export const classifyManualTicketDraft = async (req, res) => {
  try {
    const { subject = "", description = "" } = req.body || {};

    if (!subject && !description) {
      return res.status(400).json({
        status: "error",
        message: "Debes enviar subject o description para clasificar",
      });
    }

    const result = await classifyEmailForCatalog({
      subject,
      html: description,
    });

    await createLog({
      user: req.user?.id,
      action: "CLASIFICAR_TICKET_MANUAL_IA",
      module: "ai-ticket",
      description: `Clasificación borrador manual (applied=${result.aiResult?.applied ? "si" : "no"})`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    return res.json({
      status: "success",
      result,
      message: "Clasificación de ticket manual ejecutada",
    });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_CLASIFICAR_TICKET_MANUAL_IA",
      module: "ai-ticket",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });

    return res.status(500).json({
      status: "error",
      message: error.message || "Error al clasificar ticket manual",
    });
  }
};
