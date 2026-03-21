// # Modulo de Reporte #//
import { createLog } from "../logs/logs.service.js";


import { generatePDFReportService } from "./reports.pdf.services.js";
import {
  generateDailyReport,
  getReportByDate,
  getRangeReport,
  getLast7DaysReport
} from "./reports.service.js";


// 📌 Genera reporte del día actual
export const generateReportToday = async (req, res) => {
  try {
    const report = await generateDailyReport();
    await createLog({
      user: req.user?.id,
      action: "GENERAR_REPORTE_DIA",
      module: "reports",
      description: "Reporte diario generado",
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    return res.json({ status: "success", report });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_GENERAR_REPORTE_DIA",
      module: "reports",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
};


// 📌 Obtener reporte de un día (GET)
export const getReport = async (req, res) => {
  try {
    const { date } = req.params;
    const report = await getReportByDate(date);
    await createLog({
      user: req.user?.id,
      action: "OBTENER_REPORTE_DIA",
      module: "reports",
      description: `Consulta reporte fecha ${date}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    return res.json({ status: "success", report });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_REPORTE_DIA",
      module: "reports",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
};


// 📌 Obtener reporte entre fechas (POST con body)
export const getReportBetweenDates = async (req, res) => {
  try {
    const { from, to } = req.body;
    console.log(req.body);

    if (!from || !to) {
      return res.status(400).json({
        status: "error",
        message: "Los parámetros 'from' y 'to' son obligatorios en el body."
      });
    }

    const data = await getRangeReport(from, to);

    await createLog({
      user: req.user?.id,
      action: "OBTENER_REPORTE_RANGO",
      module: "reports",
      description: `Consulta reporte entre ${from} y ${to}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    return res.json({ status: "success", ...data });

  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_REPORTE_RANGO",
      module: "reports",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
};


// 📌 Últimos 7 días
export const getLast7Days = async (req, res) => {
  try {
    const data = await getLast7DaysReport();
    await createLog({
      user: req.user?.id,
      action: "OBTENER_REPORTE_7_DIAS",
      module: "reports",
      description: "Consulta de reporte últimos 7 días",
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    return res.json({ status: "success", ...data });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_REPORTE_7_DIAS",
      module: "reports",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 📌 Generar reporte en PDF  


export const generatePDFReport = async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_GENERAR_REPORTE_PDF",
        module: "reports",
        description: "Parámetros from/to faltantes",
        status: "error",
        method: "POST",
        ip: req.clientIp,
      });

      return res.status(400).json({
        status: "error",
        message: "Debe enviar from y to"
      });
    }

    await createLog({
      user: req.user?.id,
      action: "GENERAR_REPORTE_PDF",
      module: "reports",
      description: `Generación PDF entre ${from} y ${to}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    // delega 100% la generación del PDF
    await generatePDFReportService({ from, to, res });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_GENERAR_REPORTE_PDF",
      module: "reports",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });

    return res.status(500).json({ status: "error", message: error.message });
  }
};

