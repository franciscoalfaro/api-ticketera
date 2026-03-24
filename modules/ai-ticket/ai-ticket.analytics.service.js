import isomorphic from 'isomorphic-fetch';
import TicketModel from '../tickets/ticket.model.js';
import List from '../list/list.model.js';

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return 'http://127.0.0.1:11434';
  const trimmed = String(baseUrl).trim();
  const sanitized = trimmed
    .replace(/^['"]+/, '')
    .replace(/['"]+$/, '')
    .replace(/;$/, '')
    .trim();

  if (!sanitized) return 'http://127.0.0.1:11434';

  if (sanitized.startsWith('http://') || sanitized.startsWith('https://')) {
    return sanitized;
  }
  return `http://${sanitized}`;
}

const OLLAMA_BASE_URL = normalizeBaseUrl(process.env.AI_OLLAMA_BASE_URL || 'http://127.0.0.1:11434');
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL || 'qwen2.5:14b-instruct';
const AI_TIMEOUT_MS = Math.max(parseInt(process.env.AI_TIMEOUT_MS || '12000', 10) || 12000, 12000);

function parseModelList(rawValue, fallback = []) {
  if (!rawValue) return fallback;
  const list = String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

const INTERPRETER_MODELS = parseModelList(
  process.env.AI_OLLAMA_INTERPRETER_MODELS,
  [OLLAMA_MODEL]
);

const RESPONDER_MODELS = parseModelList(
  process.env.AI_OLLAMA_RESPONDER_MODELS,
  [OLLAMA_MODEL]
);

async function generateWithModelFallback(models, buildPayload) {
  const errors = [];

  for (const model of models) {
    try {
      const response = await isomorphic(
        OLLAMA_BASE_URL + '/api/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(model)),
          timeout: AI_TIMEOUT_MS,
        }
      );

      if (!response.ok) {
        const err = `[${model}] HTTP ${response.status}`;
        errors.push(err);
        continue;
      }

      const data = await response.json();
      return { ok: true, model, data, errors };
    } catch (error) {
      errors.push(`[${model}] ${error.message}`);
    }
  }

  return { ok: false, model: null, data: null, errors };
}

/**
 * Interpreta una pregunta y retorna parámetros de consulta
 */
async function interpretQuestion(question) {
  const systemPrompt = `Eres un asistente que interpreta preguntas sobre tickets en lenguaje natural.
Tu tarea es extraer parámetros de consulta en un JSON estricto.

IMPORTANTE:
- No asumas "trend_summary" si el usuario no menciona explícitamente tendencia/evolución.
- Si pregunta por "qué días hubo más tickets", usa "daily_peaks".
- Si pregunta por "causas repetidas", usa "repeated_causes".
- Si pregunta por "de qué se trató el último ticket", usa "last_ticket_detail".
- Si pregunta quién lo reportó/envió (aunque sea follow-up corto como "y quién lo reportó"), usa "last_ticket_detail".
- "last_tickets" solo cuando pidan explícitamente últimos/recientes/listado.

Retorna SOLO un JSON válido:
{
  "queryType": "last_tickets|last_ticket_detail|trend_summary|repeated_causes|daily_peaks|most_repeated|category_stats|priority_stats|status_distribution",
  "timeRange": "all|today|this_week|this_month|last_7_days|last_30_days|last_n_days",
  "limit": 5,
  "daysBack": null,
  "category": null
}

Ejemplos:
- "que dias se generaron mas ticket" => {"queryType":"daily_peaks","timeRange":"this_week","limit":5,"daysBack":null,"category":null}
- "analiza causas repetidas de los ultimos 3 dias" => {"queryType":"repeated_causes","timeRange":"last_n_days","limit":5,"daysBack":3,"category":null}
- "cual es la tendencia esta semana" => {"queryType":"trend_summary","timeRange":"this_week","limit":5,"daysBack":null,"category":null}
- "cuales fueron los ultimos 10 tickets" => {"queryType":"last_tickets","timeRange":"all","limit":10,"daysBack":null,"category":null}
- "cual es el ultimo ticket que se genero y quien lo envio" => {"queryType":"last_ticket_detail","timeRange":"all","limit":1,"daysBack":null,"category":null}
- "y quien lo reporto" => {"queryType":"last_ticket_detail","timeRange":"all","limit":1,"daysBack":null,"category":null}

PREGUNTA: "${question}"
Responde SOLO con el JSON.`;

  try {
    const result = await generateWithModelFallback(
      INTERPRETER_MODELS,
      (model) => ({
        model,
        prompt: systemPrompt,
        stream: false,
        temperature: 0.1,
        format: 'json',
        options: {
          num_predict: 120,
        },
      })
    );

    if (!result.ok) {
      console.error('[IA] Error interpretando pregunta (todos los modelos fallaron):', result.errors.join(' | '));
      return null;
    }

    const data = result.data;
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('[IA] No se pudo extraer JSON de la respuesta');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      __interpreterModel: result.model,
    };
  } catch (error) {
    console.error('[IA] Error interpretando pregunta:', error.message);
    return null;
  }
}

function fallbackInterpretQuestion(question) {
  const text = String(question || '').toLowerCase();
  const limitMatch = text.match(/(\d{1,3})/);
  const limit = limitMatch ? Number(limitMatch[1]) : 5;
  const daysMatch = text.match(/(?:ultimos?|últimos?)\s+(\d{1,3})\s+d[ií]as?/i);
  const daysBack = daysMatch ? Number(daysMatch[1]) : null;

  let timeRange = 'this_week';
  if (text.includes('hoy')) timeRange = 'today';
  else if (text.includes('esta semana')) timeRange = 'this_week';
  else if (text.includes('este mes')) timeRange = 'this_month';
  else if (text.includes('últimos 7') || text.includes('ultimos 7')) timeRange = 'last_7_days';
  else if (text.includes('últimos 30') || text.includes('ultimos 30')) timeRange = 'last_30_days';
  else if (daysBack && daysBack > 0) timeRange = 'last_n_days';
  else if (text.includes('todos') || text.includes('all')) timeRange = 'all';

  if (text.includes('tendencia') || text.includes('trend') || text.includes('patrón') || text.includes('patron')) {
    return { queryType: 'trend_summary', timeRange, limit: 5, daysBack, category: null };
  }

  if (
    text.includes('causas repetidas') ||
    text.includes('causa repetida') ||
    text.includes('incidencias repetidas') ||
    text.includes('problemas repetidos') ||
    text.includes('motivos repetidos')
  ) {
    return { queryType: 'repeated_causes', timeRange, limit: Math.max(limit, 3), daysBack, category: null };
  }

  if (
    (text.includes('que dias') || text.includes('qué días') || text.includes('qué dias') || text.includes('dias')) &&
    (text.includes('mas ticket') || text.includes('más ticket') || text.includes('se generaron') || text.includes('se crearon') || text.includes('mas incidencias'))
  ) {
    return { queryType: 'daily_peaks', timeRange, limit: Math.max(limit, 3), daysBack, category: null };
  }

  if (
    text.includes('quien lo reporto') ||
    text.includes('quién lo reportó') ||
    text.includes('quien lo envio') ||
    text.includes('quién lo envió') ||
    text.includes('quien lo envi') ||
    text.includes('quien lo creó') ||
    text.includes('quien lo creo') ||
    text.includes('quien lo levant') ||
    text.includes('reportó') ||
    text.includes('reporto')
  ) {
    return { queryType: 'last_ticket_detail', timeRange: 'all', limit: 1, daysBack: null, category: null };
  }

  if (
    (text.includes('último ticket') || text.includes('ultimo ticket')) &&
    (
      text.includes('de qué se trat') ||
      text.includes('de que se trat') ||
      text.includes('qué se trat') ||
      text.includes('que se trat') ||
      text.includes('quien lo envio') ||
      text.includes('quién lo envió') ||
      text.includes('quien lo reporto') ||
      text.includes('quién lo reportó')
    )
  ) {
    return { queryType: 'last_ticket_detail', timeRange: 'all', limit: 1, daysBack: null, category: null };
  }

  if (text.includes('últimos') || text.includes('ultimos') || text.includes('recientes')) {
    return { queryType: 'last_tickets', timeRange, limit, daysBack, category: null };
  }

  if (text.includes('categor') || text.includes('repetid') || text.includes('más reportad') || text.includes('mas reportad')) {
    return { queryType: 'most_repeated', timeRange, limit: Math.max(limit, 5), daysBack, category: null };
  }

  if (text.includes('prioridad')) {
    return { queryType: 'priority_stats', timeRange, limit, daysBack, category: null };
  }

  if (text.includes('estado') || text.includes('distribución') || text.includes('distribucion')) {
    return { queryType: 'status_distribution', timeRange, limit, daysBack, category: null };
  }

  return { queryType: 'last_tickets', timeRange: 'this_week', limit: 5, daysBack: null, category: null };
}

function chooseBestQueryParams(llmParams, fallbackParams, question = '') {
  if (!llmParams) return fallbackParams;
  if (!fallbackParams) return llmParams;

  const llmType = llmParams.queryType;
  const fallbackType = fallbackParams.queryType;

  const q = String(question || '').toLowerCase();
  const mentionsTrend = q.includes('tendencia') || q.includes('trend') || q.includes('evoluci');
  const mentionsDailyPeaks = (q.includes('dias') || q.includes('días')) && (q.includes('mas ticket') || q.includes('más ticket') || q.includes('se generaron') || q.includes('se crearon'));
  const mentionsRepeatedCauses = q.includes('causa repet') || q.includes('incidencias repetidas') || q.includes('problemas repetidos');
  const mentionsReporter =
    q.includes('quien lo reporto') ||
    q.includes('quién lo reportó') ||
    q.includes('quien lo envio') ||
    q.includes('quién lo envió') ||
    q.includes('quien lo envi') ||
    q.includes('quien reporto') ||
    q.includes('reportó') ||
    q.includes('reporto');

  if (llmType === 'last_tickets' && fallbackType !== 'last_tickets') {
    return fallbackParams;
  }

  if (llmType === 'most_repeated' && fallbackType === 'repeated_causes') {
    return fallbackParams;
  }

  if (mentionsReporter && llmType !== 'last_ticket_detail') {
    return {
      ...fallbackParams,
      queryType: 'last_ticket_detail',
      timeRange: 'all',
      limit: 1,
      daysBack: null,
    };
  }

  if (llmType === 'trend_summary' && !mentionsTrend) {
    return fallbackParams;
  }

  if (llmType === 'daily_peaks' && !mentionsDailyPeaks) {
    return fallbackParams;
  }

  if (llmType === 'repeated_causes' && !mentionsRepeatedCauses && fallbackType !== 'repeated_causes') {
    return fallbackParams;
  }

  return {
    ...fallbackParams,
    ...llmParams,
    daysBack: llmParams.daysBack ?? fallbackParams.daysBack ?? null,
  };
}

function getDateRange(timeRange, daysBack = null) {
  const now = new Date();
  let startDate = new Date(0);

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'this_week':
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_n_days': {
      const n = Number(daysBack);
      const resolved = Number.isFinite(n) && n > 0 ? n : 7;
      startDate = new Date(now.getTime() - resolved * 24 * 60 * 60 * 1000);
      break;
    }
    default:
      break;
  }

  return { startDate, endDate: now };
}

function getRangeLabel(timeRange) {
  switch (timeRange) {
    case 'today': return 'hoy';
    case 'this_week': return 'esta semana';
    case 'this_month': return 'este mes';
    case 'last_7_days': return 'los últimos 7 días';
    case 'last_30_days': return 'los últimos 30 días';
    case 'last_n_days': return 'los últimos días';
    case 'all': return 'el período analizado';
    default: return 'el período analizado';
  }
}

function getRangeLabelWithDays(timeRange, daysBack) {
  if (timeRange === 'last_n_days') {
    const n = Number(daysBack);
    if (Number.isFinite(n) && n > 0) return `los últimos ${n} días`;
    return 'los últimos días';
  }
  return getRangeLabel(timeRange);
}

async function getListValueLookup() {
  const lists = await List.find({
    name: { $in: ['Departamentos', 'Tipos de Ticket', 'Prioridades'] },
    isDeleted: false,
  }).lean();

  const lookup = {
    department: new Map(),
    type: new Map(),
    priority: new Map(),
  };

  for (const list of lists) {
    const target = list.name === 'Departamentos'
      ? lookup.department
      : list.name === 'Tipos de Ticket'
        ? lookup.type
        : list.name === 'Prioridades'
          ? lookup.priority
          : null;

    if (!target) continue;

    for (const item of list.items || []) {
      if (!item?._id) continue;
      target.set(String(item._id), item.value || item.label || String(item._id));
    }
  }

  return lookup;
}

function mapTopEntry(entry, map, fallbackLabel) {
  if (!entry) return { label: 'Sin datos', count: 0 };
  const rawId = entry._id ? String(entry._id) : null;
  const mapped = rawId ? map.get(rawId) : null;
  return {
    label: mapped || rawId || fallbackLabel,
    count: Number(entry.count || 0),
  };
}

function calculateVariation(currentCount, previousCount) {
  if (previousCount === 0) {
    return {
      trend: currentCount > 0 ? 'alza' : 'estable',
      percentage: currentCount > 0 ? 100 : 0,
    };
  }

  const diff = currentCount - previousCount;
  const percentage = Math.round((Math.abs(diff) / previousCount) * 100);

  if (diff > 0) return { trend: 'alza', percentage };
  if (diff < 0) return { trend: 'baja', percentage };
  return { trend: 'estable', percentage: 0 };
}

function stripHtml(rawText) {
  return String(rawText || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 280) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

function buildTicketNarrative(ticket) {
  if (!ticket) return 'No hay detalles disponibles para este ticket.';

  const cleanDescription = stripHtml(ticket.description || '');
  const latestUpdate = Array.isArray(ticket.updates) && ticket.updates.length > 0
    ? ticket.updates[ticket.updates.length - 1]
    : null;
  const cleanUpdate = stripHtml(latestUpdate?.message || '');

  const mainText = cleanDescription || cleanUpdate || 'Sin descripción registrada.';
  const shortened = truncateText(mainText, 340);

  return `Ticket ${ticket.code || ''}: ${ticket.subject || 'Sin asunto'}. ${shortened}`.trim();
}

function buildReporterText(reporter) {
  if (!reporter) return 'Reportante no identificado';
  const name = reporter.name ? String(reporter.name).trim() : null;
  const email = reporter.email ? String(reporter.email).trim() : null;

  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return 'Reportante no identificado';
}

function compactTicket(ticket) {
  if (!ticket) return null;
  return {
    _id: ticket._id,
    code: ticket.code,
    subject: ticket.subject,
    description: truncateText(stripHtml(ticket.description || ''), 180),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    priority: ticket.priority || null,
    department: ticket.department || null,
    type: ticket.type || null,
    status: ticket.status || null,
  };
}

function buildAnalyticsDigest(analytics) {
  if (!analytics) return { type: 'unknown' };

  switch (analytics.type) {
    case 'last_tickets':
      return {
        type: analytics.type,
        timeRange: analytics.timeRange,
        count: Array.isArray(analytics.data) ? analytics.data.length : 0,
        tickets: (analytics.data || []).slice(0, 5).map((ticket) => ({
          code: ticket.code,
          subject: ticket.subject,
          description: truncateText(stripHtml(ticket.description || ''), 120),
          createdAt: ticket.createdAt,
        })),
      };

    case 'last_ticket_detail':
      return {
        type: analytics.type,
        summary: analytics.summary,
        ticket: analytics.data
          ? {
            code: analytics.data.code,
            subject: analytics.data.subject,
            description: truncateText(stripHtml(analytics.data.description || ''), 180),
            createdAt: analytics.data.createdAt,
          }
          : null,
      };

    case 'trend_summary':
      return {
        type: analytics.type,
        summary: analytics.summary,
        currentCount: analytics.data?.currentCount || 0,
        previousCount: analytics.data?.previousCount || 0,
        variation: analytics.data?.variation || { trend: 'estable', percentage: 0 },
        top: analytics.data?.top || null,
      };

    case 'repeated_causes':
      return {
        type: analytics.type,
        summary: analytics.summary,
        rangeLabel: analytics.data?.rangeLabel,
        totalTickets: analytics.data?.totalTickets || 0,
        causes: (analytics.data?.causes || []).slice(0, 5),
      };

    case 'daily_peaks':
      return {
        type: analytics.type,
        summary: analytics.summary,
        rangeLabel: analytics.data?.rangeLabel,
        totalTickets: analytics.data?.totalTickets || 0,
        daysWithTickets: analytics.data?.daysWithTickets || 0,
        avgPerDay: analytics.data?.avgPerDay || 0,
        peak: analytics.data?.peak || null,
        topDays: (analytics.data?.topDays || []).slice(0, 5),
      };

    case 'most_repeated':
    case 'priority_stats':
    case 'status_distribution':
      return {
        type: analytics.type,
        summary: analytics.summary,
        top: (analytics.data || []).slice(0, 5),
      };

    case 'category_stats':
      return {
        type: analytics.type,
        category: analytics.category,
        summary: analytics.summary,
        count: Array.isArray(analytics.data) ? analytics.data.length : 0,
        samples: (analytics.data || []).slice(0, 3).map((ticket) => ({
          code: ticket.code,
          subject: ticket.subject,
          description: truncateText(stripHtml(ticket.description || ''), 120),
          createdAt: ticket.createdAt,
        })),
      };

    default:
      return {
        type: analytics.type,
        summary: analytics.summary,
      };
  }
}

function buildDeterministicAnswer(question, analytics) {
  const q = String(question || '').toLowerCase();

  const asksReporter =
    q.includes('quien lo reporto') ||
    q.includes('quién lo reportó') ||
    q.includes('quien lo envio') ||
    q.includes('quién lo envió') ||
    q.includes('quien lo envi') ||
    q.includes('quien lo creo') ||
    q.includes('quién lo creó') ||
    q.includes('quien reporto') ||
    q.includes('reportó') ||
    q.includes('reporto');

  if (analytics.type === 'last_ticket_detail') {
    if (asksReporter) {
      const code = analytics.data?.code || 'sin código';
      const reporter = analytics.data?.reporterText || 'reportante no identificado';
      return `El último ticket (${code}) fue reportado por ${reporter}.`;
    }
    return analytics.summary || 'No encontré detalle del último ticket.';
  }

  if (analytics.type === 'trend_summary') {
    return analytics.summary || 'No fue posible determinar una tendencia clara en el período consultado.';
  }

  if (analytics.type === 'repeated_causes') {
    const first = analytics.data?.causes?.[0];
    if (!first) return 'No encontré causas repetidas en el período consultado.';
    const others = (analytics.data?.causes || [])
      .slice(1, 3)
      .map((cause) => `${cause.subject} (${cause.count})`)
      .join(', ');
    return `${analytics.summary}${others ? ` También se repiten: ${others}.` : ''}`;
  }

  if (analytics.type === 'daily_peaks') {
    const peak = analytics.data?.peak;
    if (!peak) return 'No encontré tickets para analizar días pico.';
    const extra = (analytics.data?.topDays || [])
      .slice(1, 3)
      .map((day) => `${day.day} (${day.count})`)
      .join(', ');
    return `${analytics.summary}${extra ? ` Luego destacan ${extra}.` : ''}`;
  }

  if (analytics.type === 'most_repeated') {
    const top = analytics.data?.[0];
    if (!top) return 'No hay suficientes datos para identificar la categoría más reportada.';
    return `La categoría más reportada es ${top._id || 'N/D'} con ${top.count || 0} tickets en el período consultado.`;
  }

  if (analytics.type === 'priority_stats') {
    const top = analytics.data?.[0];
    if (!top) return 'No hay suficientes datos para identificar la prioridad dominante.';
    return `La prioridad dominante es ${top._id || 'N/D'} con ${top.count || 0} tickets.`;
  }

  if (analytics.type === 'status_distribution') {
    if (!analytics.data?.length) return 'No hay tickets para analizar la distribución por estado.';
    const head = analytics.data.slice(0, 3).map((s) => `${s._id || 'N/D'} (${s.count || 0})`).join(', ');
    return `La distribución principal por estado es: ${head}.`;
  }

  if (analytics.type === 'last_tickets') {
    const count = analytics.data?.length || 0;
    if (q.includes('de qué') || q.includes('de que') || q.includes('qué pasó') || q.includes('que paso')) {
      const first = analytics.data?.[0];
      if (!first) return 'No encontré tickets recientes para responder esa consulta.';
      return `El ticket más reciente (${first.code || 'sin código'}) trata sobre: ${first.subject || 'sin asunto'}. ${truncateText(stripHtml(first.description || ''), 140)}`;
    }
    if (!count) return 'No encontré tickets en el período consultado.';
    const first = analytics.data?.[0];
    return `Se registraron ${count} tickets en el período consultado. El más reciente es ${first?.code || 'sin código'}: ${first?.subject || 'sin asunto'}.`;
  }

  return analytics.summary || 'Listo, procesé tu consulta con los datos disponibles.';
}

async function getLastTickets(limit, timeRange, daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  const tickets = await TicketModel.find({
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .select('code subject description createdAt updatedAt priority department type status')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return tickets.map(compactTicket);
}

async function getLastTicketDetail() {
  const ticket = await TicketModel.findOne({})
    .select('code subject description createdAt updatedAt requester updates')
    .populate('requester', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  if (!ticket) return null;

  const reporter = ticket.requester && typeof ticket.requester === 'object'
    ? {
      id: ticket.requester._id || null,
      name: ticket.requester.name || null,
      email: ticket.requester.email || null,
    }
    : null;

  const reporterText = buildReporterText(reporter);

  return {
    _id: ticket._id,
    code: ticket.code,
    subject: ticket.subject,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    reporter,
    reporterText,
    narrative: `${buildTicketNarrative(ticket)} Reportado por: ${reporterText}.`,
  };
}

async function getMostRepeatedCategories(limit, timeRange) {
  const { startDate, endDate } = getDateRange(timeRange);

  const stats = await TicketModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return stats;
}

async function getPriorityStats(timeRange, daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  const stats = await TicketModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return stats;
}

async function getStatusDistribution(timeRange, daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  const stats = await TicketModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return stats;
}

async function getCategoryStats(category, timeRange, limit, daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  const tickets = await TicketModel.find({
    category: new RegExp(category, 'i'),
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .select('code subject description createdAt updatedAt priority department type status')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const count = await TicketModel.countDocuments({
    category: new RegExp(category, 'i'),
    createdAt: { $gte: startDate, $lte: endDate },
  });

  return { category, count, tickets: tickets.map(compactTicket) };
}

async function getRepeatedCauses(limit, timeRange, daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  const rows = await TicketModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $project: {
        code: 1,
        createdAt: 1,
        subject: 1,
        normalizedSubject: {
          $trim: {
            input: { $toLower: { $ifNull: ['$subject', 'sin asunto'] } },
          },
        },
      },
    },
    {
      $group: {
        _id: '$normalizedSubject',
        subject: { $first: '$subject' },
        count: { $sum: 1 },
        latestAt: { $max: '$createdAt' },
        samples: {
          $push: {
            code: '$code',
            createdAt: '$createdAt',
          },
        },
      },
    },
    { $sort: { count: -1, latestAt: -1 } },
    { $limit: Math.max(limit, 3) },
  ]);

  const totalTickets = await TicketModel.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
  });

  const top = rows[0] || null;
  const rangeLabel = getRangeLabelWithDays(timeRange, daysBack);

  const summary = !top
    ? `No se encontraron tickets en ${rangeLabel}.`
    : `En ${rangeLabel}, la causa más repetida fue "${top.subject || 'sin asunto'}" con ${top.count} de ${totalTickets} tickets.`;

  return {
    rangeLabel,
    totalTickets,
    causes: rows.map((row) => ({
      subject: row.subject || 'Sin asunto',
      count: row.count,
      latestAt: row.latestAt,
      samples: (row.samples || []).slice(0, 3),
    })),
    summary,
  };
}

async function getDailyPeaks(limit, timeRange, daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);
  const rangeLabel = getRangeLabelWithDays(timeRange, daysBack);

  const rows = await TicketModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'America/Santiago',
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: -1 } },
  ]);

  const topDays = rows.slice(0, Math.max(limit, 3)).map((row) => ({
    day: row._id,
    count: row.count,
  }));

  const totalTickets = rows.reduce((acc, row) => acc + Number(row.count || 0), 0);
  const daysWithTickets = rows.length;
  const avgPerDay = daysWithTickets > 0 ? Number((totalTickets / daysWithTickets).toFixed(2)) : 0;
  const peak = topDays[0] || null;

  const summary = !peak
    ? `No se registran tickets en ${rangeLabel}.`
    : `El día con más tickets en ${rangeLabel} fue ${peak.day} con ${peak.count} tickets. El promedio diario del período es ${avgPerDay}.`;

  return {
    rangeLabel,
    totalTickets,
    daysWithTickets,
    avgPerDay,
    peak,
    topDays,
    summary,
  };
}

async function getTrendSummary(timeRange, daysBack = null) {
  const analyzedRange = timeRange === 'all' ? 'last_30_days' : timeRange;
  const currentRange = getDateRange(analyzedRange, daysBack);

  const durationMs = currentRange.endDate.getTime() - currentRange.startDate.getTime();
  const previousEnd = new Date(currentRange.startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  const currentFilter = {
    createdAt: { $gte: currentRange.startDate, $lte: currentRange.endDate },
  };

  const previousFilter = {
    createdAt: { $gte: previousStart, $lte: previousEnd },
  };

  const [
    currentCount,
    previousCount,
    topTypes,
    topDepartments,
    topPriorities,
    lookup,
  ] = await Promise.all([
    TicketModel.countDocuments(currentFilter),
    TicketModel.countDocuments(previousFilter),
    TicketModel.aggregate([
      { $match: currentFilter },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
    TicketModel.aggregate([
      { $match: currentFilter },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
    TicketModel.aggregate([
      { $match: currentFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
    getListValueLookup(),
  ]);

  const topType = mapTopEntry(topTypes[0], lookup.type, 'Tipo no definido');
  const topDepartment = mapTopEntry(topDepartments[0], lookup.department, 'Departamento no definido');
  const topPriority = mapTopEntry(topPriorities[0], lookup.priority, 'Prioridad no definida');
  const variation = calculateVariation(currentCount, previousCount);
  const rangeLabel = getRangeLabelWithDays(analyzedRange, daysBack);

  const summary = currentCount === 0
    ? `No hay tickets en ${rangeLabel}, por lo que no se observa una tendencia clara.`
    : `En ${rangeLabel} se registraron ${currentCount} tickets, con tendencia de ${variation.trend}${variation.trend === 'estable' ? '' : ` de ${variation.percentage}%`} respecto del período anterior. Predomina ${topType.label} (${topType.count}), principalmente en ${topDepartment.label}, con prioridad ${topPriority.label}.`;

  return {
    analyzedRange,
    currentCount,
    previousCount,
    variation,
    top: {
      type: topType,
      department: topDepartment,
      priority: topPriority,
    },
    summary,
  };
}

async function generateAnalyticsResponse(queryParams) {
  const { queryType, timeRange, limit, daysBack, category } = queryParams;
  let data;

  switch (queryType) {
    case 'last_tickets':
      data = await getLastTickets(limit, timeRange, daysBack);
      return {
        type: 'last_tickets',
        timeRange,
        daysBack,
        data,
        summary: 'Se encontraron ' + data.length + ' tickets.',
      };

    case 'most_repeated':
      data = await getMostRepeatedCategories(limit, timeRange);
      return {
        type: 'most_repeated',
        timeRange,
        data,
        summary:
          data.length > 0
            ? 'La categoría más reportada es "' + data[0]._id + '" con ' + data[0].count + ' tickets.'
            : 'No hay datos disponibles.',
      };

    case 'last_ticket_detail':
      data = await getLastTicketDetail();
      return {
        type: 'last_ticket_detail',
        timeRange: 'all',
        data,
        summary: data
          ? data.narrative
          : 'No hay tickets registrados para detallar.',
      };

    case 'trend_summary':
      data = await getTrendSummary(timeRange, daysBack);
      return {
        type: 'trend_summary',
        timeRange: data.analyzedRange,
        daysBack,
        data,
        summary: data.summary,
      };

    case 'repeated_causes':
      data = await getRepeatedCauses(limit, timeRange, daysBack);
      return {
        type: 'repeated_causes',
        timeRange,
        daysBack,
        data,
        summary: data.summary,
      };

    case 'daily_peaks':
      data = await getDailyPeaks(limit, timeRange, daysBack);
      return {
        type: 'daily_peaks',
        timeRange,
        daysBack,
        data,
        summary: data.summary,
      };

    case 'category_stats':
      data = await getCategoryStats(category || 'ticket', timeRange, limit, daysBack);
      return {
        type: 'category_stats',
        category: data.category,
        timeRange,
        daysBack,
        data: data.tickets,
        summary: 'Se encontraron ' + data.count + ' tickets en la categoría "' + data.category + '".',
      };

    case 'priority_stats':
      data = await getPriorityStats(timeRange, daysBack);
      return {
        type: 'priority_stats',
        timeRange,
        daysBack,
        data,
        summary:
          data.length > 0
            ? 'La prioridad más común es "' + data[0]._id + '" con ' + data[0].count + ' tickets.'
            : 'No hay datos disponibles.',
      };

    case 'status_distribution':
      data = await getStatusDistribution(timeRange, daysBack);
      return {
        type: 'status_distribution',
        timeRange,
        daysBack,
        data,
        summary: 'Se encontraron tickets con los siguientes estados: ' + data
          .map((s) => s._id + ' (' + s.count + ')')
          .join(', ') + '.',
      };

    default:
      return {
        type: 'unknown',
        error: 'Tipo de consulta no reconocido',
      };
  }
}

export async function askAnalytics(question) {
  try {
    const llmQueryParams = await interpretQuestion(question);
    const fallbackParams = fallbackInterpretQuestion(question);
    const queryParams = chooseBestQueryParams(llmQueryParams, fallbackParams, question);

    if (!queryParams) {
      return {
        success: false,
        error: 'No se pudo interpretar la pregunta. Intenta con: "¿Cuáles fueron los últimos 5 tickets?"',
      };
    }

    const analytics = await generateAnalyticsResponse(queryParams);

    const analyticsDigest = buildAnalyticsDigest(analytics);

    const agentPrompt = 'Eres un analista senior de mesa de ayuda.\n' +
      'RESPONDE LA PREGUNTA DEL USUARIO, NO LISTES DATOS CRUDOS NI JSON.\n' +
      'Pregunta del usuario: ' + question + '\n' +
      'Datos resumidos: ' + JSON.stringify(analyticsDigest) + '\n\n' +
      'Reglas de respuesta:\n' +
      '1) Responde directo en 2-4 líneas.\n' +
      '2) Incluye interpretación (tendencia, causa principal o conclusión).\n' +
      '3) Si faltan datos, dilo explícitamente y sugiere siguiente consulta útil.\n' +
      '4) No enumeres tickets completos salvo que el usuario lo pida explícitamente.\n' +
      '5) No uses JSON ni markdown.\n';

    let agentText = buildDeterministicAnswer(question, analytics);
    let llmSummaryUsed = false;
    let interpreterModelUsed = llmQueryParams?.__interpreterModel || null;
    let responderModelUsed = null;

    try {
      const responseResult = await generateWithModelFallback(
        RESPONDER_MODELS,
        (model) => ({
          model,
          prompt: agentPrompt,
          stream: false,
          temperature: 0.3,
          options: {
            num_predict: 180,
          },
        })
      );

      if (responseResult.ok) {
        const agentData = responseResult.data;
        agentText = (agentData.response || '').trim() || agentText;
        llmSummaryUsed = true;
        responderModelUsed = responseResult.model;
      }
    } catch (_) {
    }

    if (!interpreterModelUsed && llmQueryParams) {
      interpreterModelUsed = INTERPRETER_MODELS[0] || null;
    }

    return {
      success: true,
      question,
      agentResponse: agentText,
      analytics,
      meta: {
        llmSummaryUsed,
        interpreterModelUsed,
        responderModelUsed,
      },
    };
  } catch (error) {
    console.error('[Analytics] Error:', error.message);
    return {
      success: false,
      error: 'Error procesando la consulta',
      details: error.message,
    };
  }
}

export default {
  askAnalytics,
  interpretQuestion,
  getLastTickets,
  getLastTicketDetail,
  getTrendSummary,
  getRepeatedCauses,
  getDailyPeaks,
  getMostRepeatedCategories,
  getPriorityStats,
  getStatusDistribution,
  getCategoryStats,
};
