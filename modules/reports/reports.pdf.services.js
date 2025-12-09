import PDFDocument from "pdfkit";
import path from "path";
import { getRangeReport } from "./reports.service.js";

// Paleta PowerBI PRO
const COLORS = {
  primary: "#1F3A65",
  secondary: "#FFC000",
  text: "#1A1A1A",
  gray: "#F5F6FA",
  tableHeader: "#1F2A40"
};

// Formato de fecha
const fDate = (d) => new Date(d).toISOString().split("T")[0];

// Redondeo seguro
const safe = (n) =>
  typeof n === "number" && !isNaN(n) ? n.toFixed(2) : "0";

// ============================
// Tarjetas KPI estilo PowerBI
// ============================
const drawKpiCard = (doc, x, y, title, value, color = COLORS.primary) => {
  doc
    .rect(x, y, 200, 80)
    .fill(COLORS.gray)
    .strokeColor(color)
    .lineWidth(2)
    .stroke();

  doc
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(title, x + 15, y + 12);

  doc
    .fontSize(24)
    .fillColor(color)
    .text(value, x + 15, y + 35);
};

// ============================
// Tabla PowerBI
// ============================
const drawTable = (doc, startY, title, columns, rows) => {
  const x = 40;
  const pageWidth = doc.page.width - 80;
  let y = startY;

  doc
    .fontSize(16)
    .fillColor(COLORS.primary)
    .text(title, x, y);

  y += 25;

  // Header
  doc
    .rect(x, y, pageWidth, 25)
    .fill(COLORS.tableHeader);

  doc
    .fontSize(12)
    .fillColor("white");

  let colX = x + 10;
  columns.forEach(col => {
    doc.text(col.label, colX, y + 6, { width: col.width });
    colX += col.width;
  });

  y += 25;

  // Rows
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? "#FFFFFF" : COLORS.gray;

    doc.rect(x, y, pageWidth, 25).fill(bg);
    doc.fillColor(COLORS.text);

    let colX2 = x + 10;
    columns.forEach(col => {
      doc.text(row[col.field] ?? "", colX2, y + 6, { width: col.width });
      colX2 += col.width;
    });

    y += 25;

    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });

  return y + 20;
};

// ============================
// Gráfico de barras estilo PowerBI
// ============================
const drawBarChart = (doc, x, y, width, height, data, title) => {
  // Título
  doc
    .fontSize(16)
    .fillColor(COLORS.primary)
    .text(title, x, y);
  y += 25;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barHeight = 22;
  const gap = 10;
  let posY = y;

  data.forEach(d => {
    const barWidth = (d.value / maxVal) * (width - 50);

    // Label
    doc.fontSize(12).fillColor(COLORS.text).text(d.label, x, posY);

    // Bar
    doc
      .rect(x + 120, posY + 5, barWidth, barHeight)
      .fill(COLORS.secondary);

    // Value text
    doc
      .fillColor(COLORS.primary)
      .fontSize(10)
      .text(d.value.toString(), x + 125 + barWidth, posY + 7);

    posY += barHeight + gap;
  });

  return posY;
};

// ============================
// SERVICIO PRINCIPAL PRO
// ============================
export const generatePDFReportService = async ({ from, to, res }) => {
  try {
    const report = await getRangeReport(from, to);

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Reporte_${from}_${to}.pdf"`
    );

    doc.pipe(res);

    // LOGO
    try {
      const logo = path.resolve("public/logo.png");
      doc.image(logo, 40, 20, { width: 90 });
    } catch {}

    // TÍTULO
    doc
      .fontSize(26)
      .fillColor(COLORS.primary)
      .text("Reporte de Tickets - PowerBI PRO", 150, 30);

    doc
      .fontSize(12)
      .fillColor(COLORS.text)
      .text(`Desde: ${fDate(from)} | Hasta: ${fDate(to)}`, 40, 110);

    // ============================
    // KPIs
    // ============================
    const k = report.totals;

    drawKpiCard(doc, 40, 150, "Promedio Resolución (hrs)", safe(k.avgResolutionTimeHours), COLORS.primary);
    drawKpiCard(doc, 260, 150, "Primer Contacto (hrs)", safe(k.firstResponseTimeHours), "#0E7C86");
    drawKpiCard(doc, 480, 150, "Tickets Cerrados", k.ticketsClosed, "#8F3A84");

    let y = 260;

    // ============================
    // Gráfico barras: Tickets por día
    // ============================
    const chartData = report.days.map(d => ({
      label: fDate(d.date),
      value: d.totalTickets
    }));

    y = drawBarChart(doc, 40, y, 500, 200, chartData, "Tickets creados por día");
    y += 30;

    // ============================
    // Tabla: Tickets por Agente
    // ============================
    const agents = [];

    report.days.forEach(day => {
      day.ticketsByAgent?.forEach(a => {
        if (a.agent) {
          agents.push({
            name: a.agent.name,
            email: a.agent.email,
            total: a.total
          });
        }
      });
    });

    if (agents.length > 0) {
      y = drawTable(doc, y, "Tickets por Agente", [
        { label: "Agente", field: "name", width: 150 },
        { label: "Email", field: "email", width: 240 },
        { label: "Total", field: "total", width: 80 }
      ], agents);
    }

    // FOOTER
    doc
      .fontSize(10)
      .fillColor("#666")
      .text(
        `Reporte generado automáticamente • Ticketera PowerBI PRO • ${new Date().toLocaleString()}`,
        40,
        doc.page.height - 40
      );

    doc.end();

  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: "Error generando el PDF estilo PowerBI PRO"
      });
    }
  }
};
