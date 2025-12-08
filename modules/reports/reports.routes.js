import express from "express";
import {  generateReportToday, getReport, getReportBetweenDates, getLast7Days, generatePDFReport } from "./reports.controller.js";

const router = express.Router();

// Generar reporte manual del día de los ticket creados hoy
router.get("/generate/today", generateReportToday);

// Reporte de un día específico
router.get("/:date", getReport);

// Reporte por rangos (POST con body)
router.post("/range", getReportBetweenDates);

// Últimos 7 días
router.get("/range/last7days", getLast7Days);

//pdf Reporte por rangos (POST con body)
router.post("/pdf", generatePDFReport);


export default router;
