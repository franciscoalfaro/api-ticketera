import PDFDocument from "pdfkit";
import path from "path";
import User from "../users/user.model.js";
import { getRangeReport } from "./reports.service.js";

// ============================
// Helper formateo fecha
// ============================
const formatDate = (d) => {
  try {
    if (!d) return "N/A";
    const dt = new Date(d);
    if (isNaN(dt)) return "N/A";
    return dt.toISOString().split("T")[0];
  } catch {
    return "N/A";
  }
};

// ============================
// Helper para tarjetas KPI
// ============================
const drawKpiCard = (doc, x, y, title, value) => {
  doc.rect(x, y, 200, 80).fill("#F5F6FA").stroke();

  doc.fontSize(10).fillColor("#505050").text(title, x + 15, y + 15);

  doc.fontSize(20).fillColor("#1A1A1A").text(value, x + 15, y + 35);
};

// ============================
// Helper para tablas PowerBI
// ============================
const drawTable = (doc, startY, title, columns, rows) => {
  const pageWidth = doc.page.width - 80;
  const x = 40;
  let y = startY;

  // Título
  doc.fontSize(16).fillColor("#1A1A1A").text(title, x, y);
  y += 25;

  // Encabezado
  doc.rect(x, y, pageWidth, 25).fill("#1F2A40");
  doc.fontSize(12).fillColor("white");

  let colX = x + 10;
  columns.forEach(col => {
    doc.text(col.label, colX, y + 7, { width: col.width });
    colX += col.width;
  });

  y += 25;

  // Filas
  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";

    doc.rect(x, y, pageWidth, 25).fill(bg);
    doc.fillColor("#333");

    let colX2 = x + 10;
    columns.forEach(col => {
      doc.text(row[col.field] ?? "—", colX2, y + 7, { width: col.width });
      colX2 += col.width;
    });

    y += 25;
  });

  return y + 20;
};

// ============================
// GENERAR PDF ESTILO POWERBI
// ============================
export const generatePDFReportService = async ({ from, to, res }) => {
  try {
    // Obtener reporte
    const report = await getRangeReport(from, to);

    // ============================
    // ENRIQUECER AGENTES AQUÍ
    // ============================
    const agentIds = new Set();

    report.days.forEach(day => {
      day.ticketsByAgent?.forEach(a => {
        if (a.agentId) agentIds.add(a.agentId.toString());
      });
    });

    const agentsFound = await User.find(
      { _id: { $in: [...agentIds] } },
      { name: 1, email: 1 }
    ).lean();

    const agentMap = {};
    agentsFound.forEach(a => (agentMap[a._id.toString()] = a));

    // Reemplazar agenteId → objeto agente real
    report.days = report.days.map(day => ({
      ...day,
      ticketsByAgent: day.ticketsByAgent.map(a => ({
        total: a.total,
        agent: agentMap[a.agentId] || null
      }))
    }));

    // Crear PDF
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte_${from}_${to}.pdf`
    );
    doc.pipe(res);

    // Logo
    try {
      const logoPath = path.resolve("public/logo.png");
      doc.image(logoPath, 40, 20, { width: 90 });
    } catch {}

    // Título
    doc.fontSize(26).fillColor("#1A1A1A").text("Reporte de Tickets", 140, 30);

    doc.fontSize(12).fillColor("#505050")
      .text(`Desde: ${formatDate(from)}`, 40, 110)
      .text(`Hasta: ${formatDate(to)}`, 40, 130);

    doc.moveDown(2);

    // KPI
    const kpi = report.totals;
    const safe = (n) =>
      typeof n === "number" && !isNaN(n) ? n.toFixed(2) : "N/A";

    drawKpiCard(doc, 40, 160, "Tiempo Promedio de Resolución (hrs)", safe(kpi.avgResolutionTimeHours));
    drawKpiCard(doc, 260, 160, "Primer Contacto (hrs)", safe(kpi.firstResponseTimeHours));
    drawKpiCard(doc, 480, 160, "Tickets Cerrados", kpi.ticketsClosed ?? 0);

    let y = 270;

    // Tabla: Tickets por día
    const rowsByDay = report.days.map(day => ({
      date: formatDate(day.date),
      created: day.totalTickets,
      closed: day.ticketsClosed,
      pending: day.ticketsPending
    }));

    y = drawTable(doc, y, "Tickets por Día", [
      { label: "Fecha", field: "date", width: 120 },
      { label: "Creados", field: "created", width: 100 },
      { label: "Cerrados", field: "closed", width: 100 },
      { label: "Pendientes", field: "pending", width: 120 }
    ], rowsByDay);

    if (y > 650) {
      doc.addPage();
      y = 50;
    }

    // Tabla: Tickets por agente
    const rowsAgents = [];

    report.days.forEach(day => {
      day.ticketsByAgent?.forEach(a => {
        if (a.agent) {
          rowsAgents.push({
            name: a.agent.name,
            email: a.agent.email,
            total: a.total
          });
        }
      });
    });

    if (rowsAgents.length > 0) {
      y = drawTable(doc, y, "Tickets Cerrados por Agente", [
        { label: "Agente", field: "name", width: 180 },
        { label: "Email", field: "email", width: 220 },
        { label: "Total", field: "total", width: 80 }
      ], rowsAgents);
    }

    // Pie corporativo
    doc.fontSize(10)
      .fillColor("#999")
      .text("Reporte generado automáticamente por Ticketera • PowerBI Style", 40, doc.page.height - 50);

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Error generando el PDF"
    });
  }
};
