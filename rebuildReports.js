import mongoose from "mongoose";
import Ticket from "./modules/tickets/ticket.model.js";
import { generateDailyReport } from "./modules/reports/reports.service.js";
import { connection } from "./connection/connection.js";

const run = async () => {
  try {
    connection();

    console.log("🔍 Obteniendo tickets únicos por día...");

    // Agrupamos por fecha (solo día)
    const tickets = await Ticket.find({ isDeleted: false })
      .select("createdAt")
      .lean();

    const days = new Set();

    tickets.forEach(t => {
      const d = new Date(t.createdAt);
      d.setUTCHours(0, 0, 0, 0);
      days.add(d.toISOString());
    });

    console.log("📅 Días detectados:", [...days]);

    for (const day of days) {
      console.log("⚙️ Generando reporte para:", day);
      await generateDailyReport(day);
    }

    console.log("✅ Reportes reconstruidos correctamente");
    process.exit();

  } catch (err) {
    console.error("❌ Error reconstruyendo reportes:", err);
    process.exit(1);
  }
};

run();
