// # Modulo de Reporte #//
import { createLog } from "../logs/logs.service.js";
import {
  generateDashboardOperationalExcelService,
  generateDashboardOperationalPdfService,
} from "./reports.export.services.js";
import {
  getAgentOperationalDashboard
} from "./reports.service.js";

const resolveDashboardPeriodParams = (req) => {
  const monthValue = req.body?.month ?? req.query?.month;
  const yearValue = req.body?.year ?? req.query?.year;
  const dayFromValue = req.body?.dayFrom ?? req.query?.dayFrom ?? req.body?.fromDay ?? req.query?.fromDay;
  const dayToValue = req.body?.dayTo ?? req.query?.dayTo ?? req.body?.toDay ?? req.query?.toDay;

  const month = monthValue !== undefined ? Number(monthValue) : undefined;
  const year = yearValue !== undefined ? Number(yearValue) : undefined;
  const dayFrom = dayFromValue !== undefined ? Number(dayFromValue) : undefined;
  const dayTo = dayToValue !== undefined ? Number(dayToValue) : undefined;

  return { month, year, dayFrom, dayTo, raw: { monthValue, yearValue, dayFromValue, dayToValue } };
};

const validateDashboardPeriodParams = ({ month, year, dayFrom, dayTo }) => {
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return "El parámetro 'month' debe ser un entero entre 1 y 12.";
  }

  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    return "El parámetro 'year' debe ser un entero válido entre 2000 y 2100.";
  }

  if (dayFrom !== undefined && (!Number.isInteger(dayFrom) || dayFrom < 1 || dayFrom > 31)) {
    return "El parámetro 'dayFrom' debe ser un entero entre 1 y 31.";
  }

  if (dayTo !== undefined && (!Number.isInteger(dayTo) || dayTo < 1 || dayTo > 31)) {
    return "El parámetro 'dayTo' debe ser un entero entre 1 y 31.";
  }

  const now = new Date();
  const resolvedMonth = Number.isInteger(month) ? month : now.getUTCMonth() + 1;
  const resolvedYear = Number.isInteger(year) ? year : now.getUTCFullYear();
  const daysInMonth = new Date(Date.UTC(resolvedYear, resolvedMonth, 0)).getUTCDate();

  if (dayFrom !== undefined && dayFrom > daysInMonth) {
    return `El parámetro 'dayFrom' no puede ser mayor a ${daysInMonth} para ${resolvedMonth}/${resolvedYear}.`;
  }

  if (dayTo !== undefined && dayTo > daysInMonth) {
    return `El parámetro 'dayTo' no puede ser mayor a ${daysInMonth} para ${resolvedMonth}/${resolvedYear}.`;
  }

  return null;
};


// 📌 Dashboard operativo de agentes
export const getAgentOperationalDashboardController = async (req, res) => {
  try {
    const { month, year, dayFrom, dayTo, raw } = resolveDashboardPeriodParams(req);

    const periodError = validateDashboardPeriodParams({ month, year, dayFrom, dayTo });
    if (periodError) {
      return res.status(400).json({ status: "error", message: periodError });
    }

    const data = await getAgentOperationalDashboard(month, year, dayFrom, dayTo);

    await createLog({
      user: req.user?.id,
      action: "OBTENER_DASHBOARD_OPERATIVO_AGENTES",
      module: "reports",
      description: `Consulta dashboard operativo agentes periodo ${data.period.dayFrom}-${data.period.dayTo} mes ${data.period.month}/${data.period.year}`,
      status: "success",
      method: req.method,
      ip: req.clientIp,
    });

    return res.json({ status: "success", ...data });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_DASHBOARD_OPERATIVO_AGENTES",
      module: "reports",
      description: error.message,
      status: "error",
      method: req.method,
      ip: req.clientIp,
    });

    return res.status(500).json({ status: "error", message: error.message });
  }
};

export const exportAgentOperationalDashboardPdfController = async (req, res) => {
  try {
    const { month, year, dayFrom, dayTo } = resolveDashboardPeriodParams(req);
    const periodError = validateDashboardPeriodParams({ month, year, dayFrom, dayTo });

    if (periodError) {
      return res.status(400).json({ status: "error", message: periodError });
    }

    await createLog({
      user: req.user?.id,
      action: "DESCARGAR_DASHBOARD_OPERATIVO_PDF",
      module: "reports",
      description: "Descarga PDF de dashboard operativo de agentes",
      status: "success",
      method: req.method,
      ip: req.clientIp,
    });

    await generateDashboardOperationalPdfService({ month, year, dayFrom, dayTo, res });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_DESCARGAR_DASHBOARD_OPERATIVO_PDF",
      module: "reports",
      description: error.message,
      status: "error",
      method: req.method,
      ip: req.clientIp,
    });

    return res.status(500).json({ status: "error", message: error.message });
  }
};

export const exportAgentOperationalDashboardExcelController = async (req, res) => {
  try {
    const { month, year, dayFrom, dayTo } = resolveDashboardPeriodParams(req);
    const periodError = validateDashboardPeriodParams({ month, year, dayFrom, dayTo });

    if (periodError) {
      return res.status(400).json({ status: "error", message: periodError });
    }

    await createLog({
      user: req.user?.id,
      action: "DESCARGAR_DASHBOARD_OPERATIVO_EXCEL",
      module: "reports",
      description: "Descarga Excel de dashboard operativo de agentes",
      status: "success",
      method: req.method,
      ip: req.clientIp,
    });

    await generateDashboardOperationalExcelService({ month, year, dayFrom, dayTo, res });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_DESCARGAR_DASHBOARD_OPERATIVO_EXCEL",
      module: "reports",
      description: error.message,
      status: "error",
      method: req.method,
      ip: req.clientIp,
    });

    return res.status(500).json({ status: "error", message: error.message });
  }
};

