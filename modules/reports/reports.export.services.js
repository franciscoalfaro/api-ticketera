import PDFDocument from "pdfkit";
import { getAgentOperationalDashboard } from "./reports.service.js";

const safeNumber = (value, decimals = 2) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toFixed(decimals);
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
};

export const generateDashboardOperationalPdfService = async ({ month, year, dayFrom, dayTo, res }) => {
  const data = await getAgentOperationalDashboard(month, year, dayFrom, dayTo);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const filename = `dashboard_operativo_${data.period.year}-${String(data.period.month).padStart(2, "0")}-${String(data.period.dayFrom).padStart(2, "0")}_${String(data.period.dayTo).padStart(2, "0")}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

  doc.pipe(res);

  doc.fontSize(20).text("Dashboard Operativo de Agentes", { align: "left" });
  doc.moveDown(0.5);

  doc
    .fontSize(11)
    .text(
      `Periodo: ${String(data.period.dayFrom).padStart(2, "0")}/${String(data.period.month).padStart(2, "0")}/${data.period.year} - ${String(data.period.dayTo).padStart(2, "0")}/${String(data.period.month).padStart(2, "0")}/${data.period.year}`
    );

  doc.moveDown(1);
  doc.fontSize(14).text("Resumen", { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).text(`Tiempo promedio de resolución: ${safeNumber(data.summary?.periodMetrics?.avgResolutionTimeHours, 4)} horas`);
  doc.fontSize(11).text(`Tiempo de primera respuesta: ${safeNumber(data.summary?.periodMetrics?.firstResponseTimeHours, 4)} horas`);
  doc.fontSize(11).text(`Tickets cerrados en período: ${data.summary?.periodMetrics?.totalTicketsClosed || 0}`);
  doc.fontSize(11).text(`Tickets abiertos (actual): ${data.activeWorkload?.rows?.reduce((sum, row) => sum + (row.total || 0), 0) || 0}`);
  doc.fontSize(11).text(`Tickets pendientes (actual): ${data.pendingByAgent?.rows?.reduce((sum, row) => sum + (row.total || 0), 0) || 0}`);

  doc.moveDown(1);
  doc.fontSize(14).text("Tiempo promedio de cierre por agente", { underline: true });
  doc.moveDown(0.5);

  const headers = ["Agente", "Email", "Tickets Cerrados", "Promedio (horas)", "Promedio (días)"];
  const colX = [40, 165, 340, 430, 515];

  headers.forEach((header, index) => {
    doc.fontSize(10).text(header, colX[index], doc.y, { width: index === 1 ? 170 : 80 });
  });

  doc.moveDown(0.8);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.4);

  const rows = data.closeTimeByAgentTable || [];

  if (rows.length === 0) {
    doc.fontSize(10).text("Sin datos para el período seleccionado.");
  } else {
    rows.forEach((row) => {
      const y = doc.y;
      doc.fontSize(10).text(row.agent || "-", colX[0], y, { width: 120 });
      doc.fontSize(10).text(row.email || "-", colX[1], y, { width: 170 });
      doc.fontSize(10).text(String(row.ticketsClosed || 0), colX[2], y, { width: 80, align: "right" });
      doc.fontSize(10).text(safeNumber(row.avgCloseHours, 2), colX[3], y, { width: 80, align: "right" });
      doc.fontSize(10).text(safeNumber(row.avgCloseDays, 2), colX[4], y, { width: 80, align: "right" });
      doc.moveDown(0.8);

      if (doc.y > 760) {
        doc.addPage();
      }
    });
  }

  doc.end();
};

export const generateDashboardOperationalExcelService = async ({ month, year, dayFrom, dayTo, res }) => {
  const data = await getAgentOperationalDashboard(month, year, dayFrom, dayTo);

  const filename = `dashboard_operativo_${data.period.year}-${String(data.period.month).padStart(2, "0")}-${String(data.period.dayFrom).padStart(2, "0")}_${String(data.period.dayTo).padStart(2, "0")}.csv`;

  const rows = [];

  rows.push(["Dashboard Operativo de Agentes"]);
  rows.push([
    "Periodo",
    `${String(data.period.dayFrom).padStart(2, "0")}/${String(data.period.month).padStart(2, "0")}/${data.period.year} - ${String(data.period.dayTo).padStart(2, "0")}/${String(data.period.month).padStart(2, "0")}/${data.period.year}`
  ]);
  rows.push([]);

  rows.push(["Resumen"]);
  rows.push(["Tiempo promedio de resolución (horas)", safeNumber(data.summary?.periodMetrics?.avgResolutionTimeHours, 4)]);
  rows.push(["Tiempo de primera respuesta (horas)", safeNumber(data.summary?.periodMetrics?.firstResponseTimeHours, 4)]);
  rows.push(["Tickets cerrados en período", data.summary?.periodMetrics?.totalTicketsClosed || 0]);
  rows.push(["Tickets abiertos (actual)", data.activeWorkload?.rows?.reduce((sum, row) => sum + (row.total || 0), 0) || 0]);
  rows.push(["Tickets pendientes (actual)", data.pendingByAgent?.rows?.reduce((sum, row) => sum + (row.total || 0), 0) || 0]);
  rows.push([]);

  rows.push(["Tiempo promedio de cierre por agente"]);
  rows.push(["Agente", "Email", "Tickets Cerrados", "Promedio (horas)", "Promedio (días)"]);

  for (const item of data.closeTimeByAgentTable || []) {
    rows.push([
      item.agent || "-",
      item.email || "-",
      item.ticketsClosed || 0,
      safeNumber(item.avgCloseHours, 2),
      safeNumber(item.avgCloseDays, 2)
    ]);
  }

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.send(`\uFEFF${csv}`);
};
