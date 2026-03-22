import express from "express";
import {
	exportAgentOperationalDashboardExcelController,
	exportAgentOperationalDashboardPdfController,
	getAgentOperationalDashboardController,
} from "./reports.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";


const router = express.Router();
router.use(auth);

// Dashboard operativo de agentes (incluye carga activa, pendientes y promedio cierre mensual)
router.post("/dashboard/agents/operational", getAgentOperationalDashboardController);
router.get("/dashboard/agents/operational", getAgentOperationalDashboardController);
router.get("/dashboard/agents/operational/export/pdf", exportAgentOperationalDashboardPdfController);
router.get("/dashboard/agents/operational/export/excel", exportAgentOperationalDashboardExcelController);


export default router;
