
import { createLog, getRangeReportServicePaginated, obtenerLogs } from "./logs.service.js";

export const getAllLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    if (status && !["success", "error", "warning", "info"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "El parámetro 'status' debe ser success, error, warning o info",
      });
    }

    const data = await obtenerLogs(page, limit, status);
    // No loguear las consultas de logs para evitar recursión infinita
    res.json({ status: "success", ...data });
  } catch (error) {
    // No loguear errores de logs para evitar recursión infinita
    res.status(500).json({ status: "error", message: error.message });
  }
};

// 📌 Rango de fechas
export const getRangeReportController = async (req, res) => {
  try {
    const { from, to } = req.body;
    // console.log("Fechas recibidas:", { from, to });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || req.body.status;

    if (status && !["success", "error", "warning", "info"].includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "El parámetro 'status' debe ser success, error, warning o info",
      });
    }

    if (!from || !to) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_REPORTE_RANGO",
        module: "logs",
        description: "Faltan fechas 'from' o 'to' en la consulta",
        status: "error",
        method: "POST",
        ip: req.clientIp,
      });
      return res.status(400).json({ status: "error", message: "Faltan fechas 'from' o 'to'" });
    }

    const data = await getRangeReportServicePaginated(from, to, page, limit, status);
    await createLog({
      user: req.user?.id,
      action: "OBTENER_REPORTE_RANGO",
      module: "logs",
      description: `Consulta de reporte desde ${from} hasta ${to} (página ${page})${status ? ` con estado ${status}` : ""}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    return res.json({ status: "success", ...data });

  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_REPORTE_RANGO",
      module: "logs",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
}
