// # Modulo de Reporte #//


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
    return res.json({ status: "success", report });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};


// 📌 Obtener reporte de un día (GET)
export const getReport = async (req, res) => {
  try {
    const { date } = req.params;
    const report = await getReportByDate(date);
    return res.json({ status: "success", report });
  } catch (error) {
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

    return res.json({ status: "success", ...data });

  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};


// 📌 Últimos 7 días
export const getLast7Days = async (req, res) => {
  try {
    const data = await getLast7DaysReport();
    return res.json({ status: "success", ...data });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 📌 Generar reporte en PDF  


export const generatePDFReport = async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({
      status: "error",
      message: "Debe enviar from y to"
    });
  }

  // delega 100% la generación del PDF
  await generatePDFReportService({ from, to, res });
};

