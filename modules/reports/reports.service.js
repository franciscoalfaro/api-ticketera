import Report from "./reports.model.js";
import Ticket from "../tickets/ticket.model.js";
import List from "../list/list.model.js";
import User from "../users/user.model.js";

// ================================
// 🔹 Normalizar fecha
// ================================
const normalizeDay = (dateLike) => {
    const d = dateLike ? new Date(dateLike) : new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

// ================================
// 🔹 Cargar todas las listas necesarias (una sola vez)
// ================================
const loadListsMap = async () => {
    const lists = await List.find({
        name: {
            $in: [
                "Departamentos",
                "Prioridades",
                "Estados de Ticket",
                "Impacto",
                "Tipos de Ticket",
                "Medios de Reporte"
            ]
        }
    }).lean();

    const map = {
        department: {},
        priority: {},
        status: {},
        impact: {},
        type: {},
        source: {}
    };

    for (const list of lists) {
        for (const item of list.items) {
            const info = {
                _id: item._id,
                label: item.label,
                value: item.value
            };

            switch (list.name) {
                case "Departamentos": map.department[item._id] = info; break;
                case "Prioridades": map.priority[item._id] = info; break;
                case "Estados de Ticket": map.status[item._id] = info; break;
                case "Impacto": map.impact[item._id] = info; break;
                case "Tipos de Ticket": map.type[item._id] = info; break;
                case "Medios de Reporte": map.source[item._id] = info; break;
            }
        }
    }

    return map;
};

// ================================
// 🔹 Generar reporte diario
// ================================
export const generateDailyReport = async (dateLike = new Date()) => {
    const day = normalizeDay(dateLike);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const listsMap = await loadListsMap();

    const tickets = await Ticket.find({
        createdAt: { $gte: day, $lt: nextDay },
        isDeleted: false
    })
        .select("createdAt closedAt requester assignedTo status department priority impact type source updates")
        .lean();

    const ticketsByAgent = {};
    const ticketsByDepartment = {};
    const ticketsByPriority = {};
    const ticketsByStatus = {};
    const ticketsByImpact = {};
    const ticketsByType = {};
    const ticketsBySource = {};

    let totalTickets = tickets.length;
    let ticketsClosed = 0;
    let ticketsOpen = 0;
    let ticketsPending = 0;
    let ticketsUnassigned = 0;

    let totalResolutionHours = 0;
    let closedWithResolution = 0;

    let totalFirstResponseHours = 0;
    let ticketsWithFirstResponse = 0;

    const pendingStatusId = Object.values(listsMap.status).find(s => s.value === "pending")?._id;

    for (const t of tickets) {
        const dep = t.department?.toString();
        const pri = t.priority?.toString();
        const sts = t.status?.toString();
        const imp = t.impact?.toString();
        const typ = t.type?.toString();
        const src = t.source?.toString();
        const agent = t.assignedTo?.toString();

        if (dep) ticketsByDepartment[dep] = (ticketsByDepartment[dep] || 0) + 1;
        if (pri) ticketsByPriority[pri] = (ticketsByPriority[pri] || 0) + 1;
        if (sts) ticketsByStatus[sts] = (ticketsByStatus[sts] || 0) + 1;
        if (imp) ticketsByImpact[imp] = (ticketsByImpact[imp] || 0) + 1;
        if (typ) ticketsByType[typ] = (ticketsByType[typ] || 0) + 1;
        if (src) ticketsBySource[src] = (ticketsBySource[src] || 0) + 1;
        if (agent) ticketsByAgent[agent] = (ticketsByAgent[agent] || 0) + 1;

        if (t.closedAt) ticketsClosed++;
        else ticketsOpen++;

        if (!t.assignedTo) ticketsUnassigned++;

        if (sts && pendingStatusId && sts === pendingStatusId.toString()) ticketsPending++;

        // SLA: resolución
        if (t.closedAt) {
            const diff = new Date(t.closedAt) - new Date(t.createdAt);
            const hours = diff / (1000 * 60 * 60);
            if (!isNaN(hours)) {
                totalResolutionHours += hours;
                closedWithResolution++;
            }
        }

        // SLA: primera respuesta
        if (t.updates?.length > 0) {
            const sorted = [...t.updates].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstUpdateDate = sorted[0]?.date;
            if (firstUpdateDate) {
                const diff = new Date(firstUpdateDate) - new Date(t.createdAt);
                const hours = diff / (1000 * 60 * 60);
                if (!isNaN(hours)) {
                    totalFirstResponseHours += hours;
                    ticketsWithFirstResponse++;
                }
            }
        }
    }

    const mapToArray = (obj, keyName) =>
        Object.entries(obj).map(([id, total]) => ({
            [keyName]: id,
            total
        }));

    const reportData = {
        date: day,
        totalTickets,
        ticketsClosed,
        ticketsOpen,
        ticketsPending,
        ticketsUnassigned,
        ticketsByDepartment: mapToArray(ticketsByDepartment, "departmentId"),
        ticketsByPriority: mapToArray(ticketsByPriority, "priorityId"),
        ticketsByStatus: mapToArray(ticketsByStatus, "statusId"),
        ticketsByImpact: mapToArray(ticketsByImpact, "impactId"),
        ticketsByType: mapToArray(ticketsByType, "typeId"),
        ticketsBySource: mapToArray(ticketsBySource, "sourceId"),
        ticketsByAgent: mapToArray(ticketsByAgent, "agentId"),
        avgResolutionTimeHours:
            closedWithResolution > 0 ? totalResolutionHours / closedWithResolution : 0,
        firstResponseTimeHours:
            ticketsWithFirstResponse > 0 ? totalFirstResponseHours / ticketsWithFirstResponse : 0
    };

    return await Report.findOneAndUpdate(
        { date: day },
        reportData,
        { upsert: true, new: true }
    ).lean();
};

// ================================
// 🔹 Enriquecer un reporte con nombres reales
// ================================
const enrichReport = async (report) => {
    if (!report) return report;

    const listsMap = await loadListsMap();

    // Garantizar arrays vacíos si vienen undefined
    report.ticketsByAgent = report.ticketsByAgent || [];
    report.ticketsByDepartment = report.ticketsByDepartment || [];
    report.ticketsByPriority = report.ticketsByPriority || [];
    report.ticketsByStatus = report.ticketsByStatus || [];
    report.ticketsByImpact = report.ticketsByImpact || [];
    report.ticketsByType = report.ticketsByType || [];
    report.ticketsBySource = report.ticketsBySource || [];

    // Helper para enriquecer listas (departamentos, prioridad, estado, etc.)
    const enrichGroup = (items, mapObj, field) =>
        items.map(item => ({
            total: item.total,
            [field]: mapObj[item[field]] || null
        }));

    // ==========================
    // 🔹 Enriquecer Agentes
    // ==========================
    if (report.ticketsByAgent.length > 0) {
        const ids = report.ticketsByAgent.map(a => a.agentId);

        const users = await User.find(
            { _id: { $in: ids } },
            { name: 1, email: 1 }
        ).lean();

        const userMap = {};
        users.forEach(u => {
            userMap[u._id.toString()] = {
                _id: u._id,
                name: u.name,
                email: u.email
            };
        });

        report.ticketsByAgent = report.ticketsByAgent.map(a => ({
            total: a.total,
            agent: userMap[a.agentId] || null
        }));
    }

    // ==========================
    // 🔹 Enriquecer todas las listas
    // ==========================
    report.ticketsByDepartment = enrichGroup(report.ticketsByDepartment, listsMap.department, "departmentId");
    report.ticketsByPriority = enrichGroup(report.ticketsByPriority, listsMap.priority, "priorityId");
    report.ticketsByStatus = enrichGroup(report.ticketsByStatus, listsMap.status, "statusId");
    report.ticketsByImpact = enrichGroup(report.ticketsByImpact, listsMap.impact, "impactId");
    report.ticketsByType = enrichGroup(report.ticketsByType, listsMap.type, "typeId");
    report.ticketsBySource = enrichGroup(report.ticketsBySource, listsMap.source, "sourceId");

    return report;
};


// ================================
// 🔹 Obtener reporte por fecha
// ================================
export const getReportByDate = async (dateLike) => {
    const report = await generateDailyReport(dateLike);
    return enrichReport(report);
};

// ================================
// 🔹 Obtener reportes por rango
// ================================
export const getRangeReport = async (fromDate, toDate) => {
    const from = normalizeDay(fromDate);
    const to = normalizeDay(toDate);

    const reports = await Report.find({
        date: { $gte: from, $lte: to },
    }).sort({ date: 1 }).lean();

    if (reports.length === 0) {
        return { days: [], totals: {
            totalTickets: 0,
            ticketsClosed: 0,
            ticketsOpen: 0,
            ticketsPending: 0,
            ticketsUnassigned: 0,
            avgResolutionTimeHours: 0,
            firstResponseTimeHours: 0
        }};
    }

    const totals = {
        totalTickets: 0,
        ticketsClosed: 0,
        ticketsOpen: 0,
        ticketsPending: 0,
        ticketsUnassigned: 0,
        avgResolutionTimeHours: 0,
        firstResponseTimeHours: 0
    };

    // Variables internas para promedios reales
    let sumResolutionTime = 0;
    let sumFirstContactTime = 0;
    let countResolution = 0;
    let countFirstContact = 0;

    for (const r of reports) {
        totals.totalTickets += r.totalTickets || 0;
        totals.ticketsClosed += r.ticketsClosed || 0;
        totals.ticketsOpen += r.ticketsOpen || 0;
        totals.ticketsPending += r.ticketsPending || 0;
        totals.ticketsUnassigned += r.ticketsUnassigned || 0;

        // 👉 Promedio resolución
        if (r.ticketsClosed > 0 && !isNaN(r.avgResolutionTimeHours)) {
            sumResolutionTime += r.avgResolutionTimeHours * r.ticketsClosed;
            countResolution += r.ticketsClosed;
        }

        // 👉 Promedio primer contacto
        if (r.totalTickets > 0 && !isNaN(r.firstResponseTimeHours)) {
            sumFirstContactTime += r.firstResponseTimeHours * r.totalTickets;
            countFirstContact += r.totalTickets;
        }
    }

    totals.avgResolutionTimeHours =
        countResolution > 0 ? sumResolutionTime / countResolution : 0;

    totals.firstResponseTimeHours =
        countFirstContact > 0 ? sumFirstContactTime / countFirstContact : 0;

    return {
        days: reports,
        totals
    };
};


// ================================
// 🔹 Últimos 7 días
// ================================
export const getLast7DaysReport = async () => {
    const today = normalizeDay(new Date());
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return getRangeReport(from, today);
};

const resolvePeriodRange = (month, year, dayFrom, dayTo) => {
    const now = new Date();
    const safeMonth = Number.isInteger(month) ? month : now.getUTCMonth() + 1;
    const safeYear = Number.isInteger(year) ? year : now.getUTCFullYear();

    const daysInMonth = new Date(Date.UTC(safeYear, safeMonth, 0)).getUTCDate();

    const rawDayFrom = Number.isInteger(dayFrom) ? dayFrom : 1;
    const rawDayTo = Number.isInteger(dayTo) ? dayTo : daysInMonth;

    const boundedDayFrom = Math.max(1, Math.min(rawDayFrom, daysInMonth));
    const boundedDayTo = Math.max(1, Math.min(rawDayTo, daysInMonth));

    const safeDayFrom = Math.min(boundedDayFrom, boundedDayTo);
    const safeDayTo = Math.max(boundedDayFrom, boundedDayTo);

    const from = new Date(Date.UTC(safeYear, safeMonth - 1, safeDayFrom, 0, 0, 0, 0));
    const to = new Date(Date.UTC(safeYear, safeMonth - 1, safeDayTo + 1, 0, 0, 0, 0));

    return {
        month: safeMonth,
        year: safeYear,
        dayFrom: safeDayFrom,
        dayTo: safeDayTo,
        from,
        to
    };
};

// ================================
// 🔹 Tiempo promedio de cierre por agente (horas)
// ================================
export const getAvgCloseTimeByAgent = async (month, year, dayFrom, dayTo) => {
    const period = resolvePeriodRange(month, year, dayFrom, dayTo);

    const rows = await Ticket.aggregate([
        {
            $match: {
                isDeleted: false,
                assignedTo: { $ne: null },
                createdAt: { $ne: null },
                closedAt: { $ne: null, $gte: period.from, $lt: period.to }
            }
        },
        {
            $addFields: {
                closeHours: {
                    $divide: [
                        { $subtract: ["$closedAt", "$createdAt"] },
                        1000 * 60 * 60
                    ]
                }
            }
        },
        {
            $group: {
                _id: "$assignedTo",
                avgCloseHours: { $avg: "$closeHours" },
                ticketsClosed: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "agent"
            }
        },
        {
            $unwind: {
                path: "$agent",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 0,
                agentId: "$_id",
                agent: {
                    _id: "$agent._id",
                    name: "$agent.name",
                    email: "$agent.email"
                },
                avgCloseHours: { $round: ["$avgCloseHours", 2] },
                avgCloseDays: {
                    $round: [
                        {
                            $divide: ["$avgCloseHours", 24]
                        },
                        2
                    ]
                },
                ticketsClosed: 1
            }
        },
        {
            $sort: { avgCloseHours: 1 }
        }
    ]);

    return {
        month: period.month,
        year: period.year,
        dayFrom: period.dayFrom,
        dayTo: period.dayTo,
        from: period.from,
        to: period.to,
        totalAgents: rows.length,
        rows
    };
};

const getStatusIds = async () => {
    const estadosList = await List.findOne({ name: "Estados de Ticket", isDeleted: false }).lean();

    if (!estadosList) {
        return { openId: null, pendingId: null, closedId: null };
    }

    const openId = estadosList.items.find((i) => i.value === "open")?._id;
    const pendingId = estadosList.items.find((i) => i.value === "pending")?._id;
    const closedId = estadosList.items.find((i) => i.value === "closed")?._id;

    return { openId, pendingId, closedId };
};

const aggregateByAgent = async (matchFilter) => {
    return Ticket.aggregate([
        { $match: matchFilter },
        {
            $group: {
                _id: "$assignedTo",
                total: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "agent"
            }
        },
        {
            $unwind: {
                path: "$agent",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 0,
                agentId: "$_id",
                agent: {
                    _id: "$agent._id",
                    name: "$agent.name",
                    email: "$agent.email"
                },
                total: 1
            }
        },
        { $sort: { total: -1 } }
    ]);
};

// ================================
// 🔹 Carga activa por agente (tickets abiertos)
// ================================
export const getActiveWorkloadByAgentReport = async (period) => {
    const { closedId } = await getStatusIds();

    const filter = {
        isDeleted: false,
        assignedTo: { $ne: null }
    };

    if (period?.from && period?.to) {
        filter.createdAt = { $gte: period.from, $lt: period.to };
    }

    if (closedId) {
        filter.status = { $ne: closedId };
    }

    const rows = await aggregateByAgent(filter);

    return {
        totalAgents: rows.length,
        rows
    };
};

// ================================
// 🔹 Tickets pendientes por agente
// ================================
export const getPendingTicketsByAgentReport = async (period) => {
    const { pendingId } = await getStatusIds();

    if (!pendingId) {
        return {
            totalAgents: 0,
            rows: []
        };
    }

    const filter = {
        isDeleted: false,
        assignedTo: { $ne: null },
        status: pendingId
    };

    if (period?.from && period?.to) {
        filter.createdAt = { $gte: period.from, $lt: period.to };
    }

    const rows = await aggregateByAgent(filter);

    return {
        totalAgents: rows.length,
        rows
    };
};

// ================================
// 🔹 Tiempo promedio de cierre general (sin agente)
// ================================
export const getAvgCloseTimeGeneral = async (month, year) => {
    const now = new Date();
    const safeMonth = Number.isInteger(month) ? month : now.getUTCMonth() + 1;
    const safeYear = Number.isInteger(year) ? year : now.getUTCFullYear();

    const from = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0, 0));

    const result = await Ticket.aggregate([
        {
            $match: {
                isDeleted: false,
                createdAt: { $ne: null },
                closedAt: { $ne: null, $gte: from, $lt: to }
            }
        },
        {
            $addFields: {
                closeHours: {
                    $divide: [
                        { $subtract: ["$closedAt", "$createdAt"] },
                        1000 * 60 * 60
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                avgCloseHours: { $avg: "$closeHours" },
                totalTicketsClosed: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                avgCloseHours: { $round: ["$avgCloseHours", 2] },
                totalTicketsClosed: 1
            }
        }
    ]);

    const data = result.length > 0 ? result[0] : { avgCloseHours: 0, totalTicketsClosed: 0 };

    return {
        month: safeMonth,
        year: safeYear,
        from,
        to,
        ...data
    };
};

const getCurrentPeriodSummary = async (period) => {
    const [resolutionData, firstResponseData] = await Promise.all([
        Ticket.aggregate([
            {
                $match: {
                    isDeleted: false,
                    createdAt: { $ne: null },
                    closedAt: { $ne: null, $gte: period.from, $lt: period.to }
                }
            },
            {
                $addFields: {
                    resolutionHours: {
                        $divide: [
                            { $subtract: ["$closedAt", "$createdAt"] },
                            1000 * 60 * 60
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResolutionTimeHours: { $avg: "$resolutionHours" },
                    totalTicketsClosed: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    avgResolutionTimeHours: { $round: ["$avgResolutionTimeHours", 4] },
                    totalTicketsClosed: 1
                }
            }
        ]),
        Ticket.aggregate([
            {
                $match: {
                    isDeleted: false,
                    createdAt: { $gte: period.from, $lt: period.to }
                }
            },
            {
                $addFields: {
                    firstUpdateDate: { $min: "$updates.date" }
                }
            },
            {
                $match: {
                    firstUpdateDate: { $ne: null }
                }
            },
            {
                $addFields: {
                    firstResponseHours: {
                        $divide: [
                            { $subtract: ["$firstUpdateDate", "$createdAt"] },
                            1000 * 60 * 60
                        ]
                    }
                }
            },
            {
                $match: {
                    firstResponseHours: { $gte: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    firstResponseTimeHours: { $avg: "$firstResponseHours" }
                }
            },
            {
                $project: {
                    _id: 0,
                    firstResponseTimeHours: { $round: ["$firstResponseTimeHours", 4] }
                }
            }
        ])
    ]);

    const resolution = resolutionData[0] || {
        avgResolutionTimeHours: 0,
        totalTicketsClosed: 0
    };

    const firstResponse = firstResponseData[0] || {
        firstResponseTimeHours: 0
    };

    return {
        avgResolutionTimeHours: resolution.avgResolutionTimeHours || 0,
        firstResponseTimeHours: firstResponse.firstResponseTimeHours || 0,
        totalTicketsClosed: resolution.totalTicketsClosed || 0
    };
};

// ================================
// 🔹 Dashboard operativo de agentes
// ================================
export const getAgentOperationalDashboard = async (month, year, dayFrom, dayTo) => {
    const period = resolvePeriodRange(month, year, dayFrom, dayTo);

    const [activeWorkload, pendingByAgent, avgCloseTimeByAgent, periodSummary, monthReference, today, last7Days] = await Promise.all([
        getActiveWorkloadByAgentReport(period),
        getPendingTicketsByAgentReport(period),
        getAvgCloseTimeByAgent(period.month, period.year, period.dayFrom, period.dayTo),
        getCurrentPeriodSummary(period),
        getAvgCloseTimeGeneral(period.month, period.year),
        getReportByDate(new Date()),
        getLast7DaysReport()
    ]);

    const closeTimeByAgentTable = avgCloseTimeByAgent.rows.map((row) => ({
        agent: row.agent?.name || "Sin asignar",
        email: row.agent?.email || null,
        ticketsClosed: row.ticketsClosed,
        avgCloseHours: row.avgCloseHours,
        avgCloseDays: row.avgCloseDays
    }));

    return {
        period,
        summary: {
            today,
            last7Days,
            periodMetrics: periodSummary,
            monthReference
        },
        activeWorkload,
        pendingByAgent,
        avgCloseTimeByAgent,
        closeTimeByAgentTable
    };
};

