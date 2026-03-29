import isomorphic from 'isomorphic-fetch';
import mongoose from 'mongoose';
import TicketModel from '../tickets/ticket.model.js';
import List from '../list/list.model.js';

/* =========================
   CONFIG
========================= */

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return 'http://127.0.0.1:11434';
  const sanitized = String(baseUrl).trim().replace(/^['"]+|['"]+$/g, '');
  if (!sanitized) return 'http://127.0.0.1:11434';
  if (sanitized.startsWith('http')) return sanitized;
  return `http://${sanitized}`;
}

function normalizeOptionalBaseUrl(baseUrl) {
  if (!baseUrl) return null;
  const sanitized = String(baseUrl).trim().replace(/^['"]+|['"]+$/g, '');
  if (!sanitized) return null;
  if (sanitized.startsWith('http')) return sanitized;
  return `http://${sanitized}`;
}

function parseModelList(rawValue, fallback = []) {
  if (!rawValue) return fallback;
  const list = String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

const OLLAMA_BASE_URL = normalizeBaseUrl(process.env.AI_OLLAMA_BASE_URL);
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL || 'minimax-m2:cloud';
const AI_MIN_CONFIDENCE = Number(process.env.AI_MIN_CONFIDENCE || 0.7);
const AI_TIMEOUT_MS = Math.max(Number.parseInt(process.env.AI_TIMEOUT_MS || '60000', 10) || 60000, 8000);
const AI_DB_TIMEOUT_MS = Math.max(Number.parseInt(process.env.AI_DB_TIMEOUT_MS || '15000', 10) || 15000, 2000);

const CLOUD_BASE_URL = normalizeOptionalBaseUrl(process.env.AI_CLOUD_BASE_URL);
const CLOUD_API_KEY = String(process.env.AI_CLOUD_API_KEY || '').trim();
const CLOUD_AUTH_HEADER = String(process.env.AI_CLOUD_AUTH_HEADER || 'Authorization').trim();
const CLOUD_AUTH_SCHEME = String(process.env.AI_CLOUD_AUTH_SCHEME || 'Bearer').trim();
const CLOUD_GENERATE_PATH = String(process.env.AI_CLOUD_GENERATE_PATH || '/api/generate').trim();
const CLOUD_ONLY = String(process.env.AI_CLOUD_ONLY || 'false').trim().toLowerCase() === 'true';

const INTERPRETER_MODELS = parseModelList(
  process.env.AI_OLLAMA_INTERPRETER_MODELS,
  [OLLAMA_MODEL]
);

const RESPONDER_MODELS = parseModelList(
  process.env.AI_OLLAMA_RESPONDER_MODELS,
  [OLLAMA_MODEL]
);

const DYNAMIC_PLANNER_MODELS = parseModelList(
  process.env.AI_OLLAMA_PLANNER_MODELS,
  INTERPRETER_MODELS
);

const DYNAMIC_MAX_LIMIT = Math.max(Number.parseInt(process.env.AI_DYNAMIC_MAX_LIMIT || '50', 10) || 50, 5);
const DYNAMIC_MAX_PIPELINE_STAGES = Math.max(Number.parseInt(process.env.AI_DYNAMIC_MAX_PIPELINE_STAGES || '20', 10) || 20, 5);

const ALLOWED_COLLECTIONS = new Set(['tickets']);
const ALLOWED_OPERATIONS = new Set(['find', 'aggregate']);
const KNOWN_QUERY_TYPES = new Set([
  'last_tickets',
  'last_ticket_detail',
  'last_closed_ticket_detail',
  'ticket_assignee_by_code',
  'top_reporters',
  'top_closers',
  'trend_summary',
]);
const DANGEROUS_OPERATORS = new Set([
  '$where',
  '$function',
  '$accumulator',
  '$merge',
  '$out',
]);
const ALLOWED_TICKET_FIELDS = new Set([
  '_id',
  'code',
  'subject',
  'description',
  'requester',
  'assignedTo',
  'status',
  'priority',
  'impact',
  'department',
  'type',
  'source',
  'closedBy',
  'closedAt',
  'isDeleted',
  'deletedAt',
  'createdAt',
  'updatedAt',
]);

const TICKET_LIST_FIELD_MAP = {
  status: 'Estados de Ticket',
  priority: 'Prioridades',
  impact: 'Impacto',
  department: 'Departamentos',
  type: 'Tipos de Ticket',
  source: 'Medios de Reporte',
};

/* =========================
   UTILS
========================= */

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await isomorphic(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function withTimeout(promise, timeoutMs, label = 'operation') {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`${label}_TIMEOUT`);
      error.code = `${label}_TIMEOUT`;
      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function clampLimit(value, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), DYNAMIC_MAX_LIMIT);
}

function extractTicketCode(question) {
  const text = String(question || '').toUpperCase();
  const match = text.match(/\b([A-Z]{2,}-\d{1,7})\b/);
  return match ? match[1] : null;
}

function assertMongoConnected() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('MONGODB_NOT_CONNECTED');
    error.code = 'MONGODB_NOT_CONNECTED';
    throw error;
  }
}

function isCloudModel(modelName = '') {
  return /(:|-)?cloud$/i.test(String(modelName || '').trim());
}

function resolveModelTarget(modelName) {
  const cloudModel = isCloudModel(modelName);
  if (!cloudModel) {
    if (CLOUD_ONLY) {
      return {
        invalid: true,
        reason: `AI_CLOUD_ONLY=true y el modelo "${modelName}" no es cloud.`,
      };
    }

    return {
      provider: 'local',
      baseUrl: OLLAMA_BASE_URL,
      path: '/api/generate',
      headers: {},
    };
  }

  if (!CLOUD_BASE_URL) {
    return {
      invalid: true,
      reason: `Modelo cloud "${modelName}" sin AI_CLOUD_BASE_URL válido.`,
    };
  }

  if (!CLOUD_API_KEY) {
    return {
      invalid: true,
      reason: `Modelo cloud "${modelName}" sin AI_CLOUD_API_KEY.`,
    };
  }

  const headers = {};
  const isAuthorization = CLOUD_AUTH_HEADER.toLowerCase() === 'authorization';
  headers[CLOUD_AUTH_HEADER] = isAuthorization
    ? `${CLOUD_AUTH_SCHEME} ${CLOUD_API_KEY}`
    : CLOUD_API_KEY;

  return {
    provider: 'cloud',
    baseUrl: CLOUD_BASE_URL,
    path: CLOUD_GENERATE_PATH || '/api/generate',
    headers,
  };
}

async function generateWithModelFallback(models, buildPayload, contextLabel = 'task') {
  const errors = [];

  for (const model of models) {
    const target = resolveModelTarget(model);
    if (target.invalid) {
      const invalidError = `[${contextLabel}] [${model}] ${target.reason}`;
      errors.push(invalidError);
      console.warn('[AI Analytics] MODEL_SKIPPED', {
        context: contextLabel,
        model,
        reason: target.reason,
      });
      continue;
    }

    const url = `${target.baseUrl}${target.path}`;
    const payload = buildPayload(model);

    try {
      console.log('[AI Analytics] MODEL_ATTEMPT', {
        context: contextLabel,
        model,
        provider: target.provider,
        url,
      });

      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...target.headers,
          },
          body: JSON.stringify(payload),
        },
        AI_TIMEOUT_MS
      );

      if (!res.ok) {
        const bodyText = await res.text();
        const errorText = `[${contextLabel}] [${model}] HTTP ${res.status} ${bodyText?.slice(0, 220) || ''}`;
        errors.push(errorText);
        console.warn('[AI Analytics] MODEL_FAILED', { context: contextLabel, model, status: res.status });
        continue;
      }

      const data = await res.json();
      return {
        ok: true,
        data,
        model,
        provider: target.provider,
        errors,
      };
    } catch (error) {
      const errorText = `[${contextLabel}] [${model}] ${error.message}`;
      errors.push(errorText);
      console.warn('[AI Analytics] MODEL_ERROR', { context: contextLabel, model, error: error.message });
    }
  }

  return {
    ok: false,
    data: null,
    model: null,
    provider: null,
    errors,
  };
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(word));
}

function getDateRange(timeRange = 'this_week', daysBack = null) {
  const now = new Date();
  let startDate = new Date(0);

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
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
      const resolved = Number(daysBack) > 0 ? Number(daysBack) : 7;
      startDate = new Date(now.getTime() - resolved * 24 * 60 * 60 * 1000);
      break;
    }
    case 'all':
    default:
      break;
  }

  return { startDate, endDate: now };
}

/* =========================
   INTENT SIGNALS
========================= */

function getQuestionSignals(question) {
  const q = String(question || '').toLowerCase();
  const qNormalized = normalizeText(question);
  const qSignal = `${q} ${qNormalized}`;
  const ticketCode = extractTicketCode(question);
  const mentionsAgent = includesAny(qSignal, ['agente', 'agentes', 'usuario', 'usuarios', 'quien', 'quién', 'kien']);
  const mentionsClosureAction = includesAny(qSignal, ['cerro', 'cerró', 'cerrad', 'cerrar', 'resolv', 'cerrao', 'serro', 'serrao']);
  const asksRanking = includesAny(qSignal, ['mas', 'más', 'top', 'mayor', 'numero 1', 'número 1']);

  return {
    q,
    qNormalized,
    ticketCode,

    mentionsTrend: includesAny(qSignal, ['tendencia', 'trend', 'evoluci']),

    mentionsRepeatedCauses: includesAny(qSignal, ['repetid', 'causa', 'problema']),

    mentionsDailyPeaks: includesAny(qSignal, ['dia', 'día', 'pico']),

    mentionsReporter:
      includesAny(qSignal, ['quien', 'quién', 'kien']) && qSignal.includes('report'),

    mentionsTopReporters:
      includesAny(qSignal, ['usuario', 'usuarios', 'quien', 'quién', 'kien']) &&
      includesAny(qSignal, ['report', 'ticket', 'tiket', 'tiket', 'tikets']),

    mentionsTopClosers:
      mentionsAgent &&
      mentionsClosureAction &&
      asksRanking,

    asksLastClosedTicket:
      (qSignal.includes('ultimo ticket') || qSignal.includes('último ticket')) &&
      includesAny(qSignal, ['cerro', 'cerró', 'cerrado', 'resolv']),

    asksLastTickets:
      includesAny(qSignal, ['recientes', 'lista']) ||
      /(?:ultimos|últimos)?\s*\d*\s*(?:tickets?|tikets?|tiket?s?)/i.test(qSignal),

    asksTicketAssigneeByCode:
      Boolean(ticketCode) &&
      (
        includesAny(qSignal, ['quien', 'quién', 'kien']) &&
        includesAny(qSignal, ['asignad', 'asigno', 'asignó'])
      ),
  };
}

/* =========================
   FALLBACK INTENT
========================= */

function fallbackInterpretQuestion(question) {
  const q = String(question || '').toLowerCase();
  const limitMatch = q.match(/\d+/);
  const limit = limitMatch ? clampLimit(limitMatch[0], 5) : 5;

  let timeRange = 'this_week';
  if (q.includes('hoy')) timeRange = 'today';
  else if (q.includes('este mes')) timeRange = 'this_month';
  else if (q.includes('últimos 7') || q.includes('ultimos 7')) timeRange = 'last_7_days';
  else if (q.includes('últimos 30') || q.includes('ultimos 30')) timeRange = 'last_30_days';
  else if (q.includes('todos')) timeRange = 'all';

  const daysMatch = q.match(/(?:ultimos?|últimos?)\s+(\d{1,3})\s+d[ií]as?/i);
  const daysBack = daysMatch ? Number(daysMatch[1]) : null;
  if (daysBack) timeRange = 'last_n_days';

  if (q.includes('últimos') || q.includes('ultimos') || q.includes('recientes')) {
    return { queryType: 'last_tickets', timeRange: 'all', limit, daysBack: null };
  }

  return { queryType: 'last_tickets', timeRange, limit, daysBack };
}

/* =========================
   LLM INTERPRETER
========================= */

async function interpretQuestion(question) {
  try {
    const result = await generateWithModelFallback(
      INTERPRETER_MODELS,
      (model) => ({
        model,
        prompt: `Devuelve JSON estricto con: queryType,timeRange,limit,daysBack,category para: "${question}"`,
        stream: false,
        format: 'json',
      }),
      'interpret_question'
    );

    if (!result.ok) {
      console.warn('[AI Analytics] INTERPRETER_ALL_FAILED', { errors: result.errors });
      return null;
    }

    const match = result.data?.response?.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    return {
      ...parsed,
      __interpreterModel: result.model,
      __interpreterProvider: result.provider,
    };
  } catch {
    return null;
  }
}

/* =========================
   DYNAMIC QUERY PLANNER
========================= */

function safeJsonParse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  try {
    const strict = rawText.trim();
    return JSON.parse(strict);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function hasDangerousOperators(value) {
  if (Array.isArray(value)) return value.some((item) => hasDangerousOperators(item));
  if (!value || typeof value !== 'object') return false;

  for (const [key, child] of Object.entries(value)) {
    if (DANGEROUS_OPERATORS.has(key)) return true;
    if (hasDangerousOperators(child)) return true;
  }

  return false;
}

function pathRoot(path = '') {
  return String(path || '').replace(/^\$+/, '').split('.')[0];
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasDisallowedFieldReferences(value, allowedFields) {
  if (Array.isArray(value)) return value.some((item) => hasDisallowedFieldReferences(item, allowedFields));
  if (!value || typeof value !== 'object') return false;

  for (const [key, child] of Object.entries(value)) {
    const rootKey = pathRoot(key);
    if (!key.startsWith('$') && rootKey && !allowedFields.has(rootKey)) {
      return true;
    }

    if (typeof child === 'string' && child.startsWith('$')) {
      const fieldRef = pathRoot(child);
      if (fieldRef && !fieldRef.startsWith('$') && !allowedFields.has(fieldRef)) {
        return true;
      }
    }

    if (hasDisallowedFieldReferences(child, allowedFields)) return true;
  }

  return false;
}

function sanitizeDynamicQuery(dynamicQuery) {
  if (!dynamicQuery || typeof dynamicQuery !== 'object') {
    throw new Error('DYNAMIC_QUERY_INVALID_PAYLOAD');
  }

  const operation = String(dynamicQuery.operation || '').trim().toLowerCase();
  const collection = String(dynamicQuery.collection || 'tickets').trim().toLowerCase();

  if (!ALLOWED_COLLECTIONS.has(collection)) {
    throw new Error(`DYNAMIC_QUERY_COLLECTION_NOT_ALLOWED:${collection || 'empty'}`);
  }

  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new Error(`DYNAMIC_QUERY_OPERATION_NOT_ALLOWED:${operation || 'empty'}`);
  }

  if (hasDangerousOperators(dynamicQuery)) {
    throw new Error('DYNAMIC_QUERY_DANGEROUS_OPERATOR');
  }

  const limit = Math.min(Math.max(Number(dynamicQuery.limit) || 10, 1), DYNAMIC_MAX_LIMIT);
  const normalized = {
    type: 'mongo_query',
    collection,
    operation,
    limit,
    explanation: String(dynamicQuery.explanation || '').slice(0, 300),
  };

  if (operation === 'find') {
    const filter = dynamicQuery.filter && typeof dynamicQuery.filter === 'object' ? dynamicQuery.filter : {};
    const sort = dynamicQuery.sort && typeof dynamicQuery.sort === 'object' ? dynamicQuery.sort : { createdAt: -1 };
    const projection = dynamicQuery.projection && typeof dynamicQuery.projection === 'object'
      ? dynamicQuery.projection
      : {
        _id: 1,
        code: 1,
        subject: 1,
        requester: 1,
        createdAt: 1,
        updatedAt: 1,
      };

    if (hasDisallowedFieldReferences({ filter, sort, projection }, ALLOWED_TICKET_FIELDS)) {
      throw new Error('DYNAMIC_QUERY_DISALLOWED_FIELD_REFERENCE');
    }

    normalized.filter = {
      isDeleted: { $ne: true },
      ...filter,
    };
    normalized.sort = sort;
    normalized.projection = projection;
    return normalized;
  }

  const pipeline = Array.isArray(dynamicQuery.pipeline) ? dynamicQuery.pipeline : [];

  if (!pipeline.length) {
    throw new Error('DYNAMIC_QUERY_EMPTY_PIPELINE');
  }

  if (pipeline.length > DYNAMIC_MAX_PIPELINE_STAGES) {
    throw new Error('DYNAMIC_QUERY_PIPELINE_TOO_LARGE');
  }

  if (hasDisallowedFieldReferences(pipeline, ALLOWED_TICKET_FIELDS)) {
    throw new Error('DYNAMIC_QUERY_DISALLOWED_FIELD_REFERENCE');
  }

  const firstStage = pipeline[0];
  const startsWithMatch = firstStage && typeof firstStage === 'object' && !Array.isArray(firstStage) && '$match' in firstStage;

  normalized.pipeline = startsWithMatch
    ? [
      {
        $match: {
          isDeleted: { $ne: true },
          ...(firstStage.$match || {}),
        },
      },
      ...pipeline.slice(1),
      { $limit: limit },
    ]
    : [
      { $match: { isDeleted: { $ne: true } } },
      ...pipeline,
      { $limit: limit },
    ];

  return normalized;
}

async function planDynamicQuery(question) {
  const plannerPrompt = [
    'Devuelve SOLO JSON válido (sin markdown) con forma:',
    '{"type":"mongo_query","collection":"tickets","operation":"find|aggregate","filter":{},"projection":{},"sort":{},"limit":10,"pipeline":[],"explanation":"..."}',
    'Reglas obligatorias:',
    '- Solo colección tickets.',
    '- Solo operation find o aggregate.',
    '- No uses $where, $function, $accumulator, $merge, $out.',
    '- Incluye limit <= 50.',
    '- Si operation=aggregate, incluye pipeline no vacío.',
    '- Si operation=find, incluye filter/sort/projection.',
    `Pregunta: "${question}"`,
  ].join('\n');

  const result = await generateWithModelFallback(
    DYNAMIC_PLANNER_MODELS,
    (model) => ({
      model,
      prompt: plannerPrompt,
      stream: false,
      format: 'json',
    }),
    'plan_dynamic_query'
  );

  if (!result.ok) {
    return { ok: false, reason: 'DYNAMIC_PLANNER_MODELS_FAILED', errors: result.errors };
  }

  const parsed = safeJsonParse(result.data?.response);
  if (!parsed) {
    return { ok: false, reason: 'DYNAMIC_PLANNER_INVALID_JSON', errors: result.errors };
  }

  try {
    const query = sanitizeDynamicQuery(parsed);
    return {
      ok: true,
      query,
      model: result.model,
      provider: result.provider,
      errors: result.errors,
    };
  } catch (validationError) {
    return {
      ok: false,
      reason: validationError.message,
      errors: [...(result.errors || []), validationError.message],
      model: result.model,
      provider: result.provider,
    };
  }
}

async function resolveListItemObjectId(fieldName, rawValue) {
  const listName = TICKET_LIST_FIELD_MAP[fieldName];
  if (!listName) return rawValue;

  if (mongoose.Types.ObjectId.isValid(rawValue)) return rawValue;
  if (typeof rawValue !== 'string' || !rawValue.trim()) return rawValue;

  const normalized = normalizeText(rawValue);
  if (!normalized) return rawValue;

  const list = await List.findOne({ name: listName, isDeleted: false })
    .select('items._id items.label items.value items.isDeleted')
    .lean();

  if (!list?.items?.length) return rawValue;

  const candidates = list.items.filter((item) => item && item.isDeleted !== true);
  const exact = candidates.find((item) => {
    const label = normalizeText(item.label);
    const value = normalizeText(item.value);
    return normalized === label || normalized === value;
  });

  if (exact?._id) return exact._id;

  const partial = candidates.find((item) => {
    const label = normalizeText(item.label);
    const value = normalizeText(item.value);
    return label.includes(normalized) || value.includes(normalized) || normalized.includes(label) || normalized.includes(value);
  });

  return partial?._id || rawValue;
}

async function resolveReferenceValue(fieldName, value) {
  if (Array.isArray(value)) {
    const resolved = [];
    for (const item of value) {
      resolved.push(await resolveReferenceValue(fieldName, item));
    }
    return resolved;
  }

  if (!value || typeof value !== 'object') {
    return resolveListItemObjectId(fieldName, value);
  }

  const resolved = { ...value };

  if (Object.prototype.hasOwnProperty.call(resolved, '$eq')) {
    resolved.$eq = await resolveListItemObjectId(fieldName, resolved.$eq);
  }

  if (Object.prototype.hasOwnProperty.call(resolved, '$ne')) {
    resolved.$ne = await resolveListItemObjectId(fieldName, resolved.$ne);
  }

  if (Array.isArray(resolved.$in)) {
    resolved.$in = await Promise.all(resolved.$in.map((item) => resolveListItemObjectId(fieldName, item)));
  }

  if (Array.isArray(resolved.$nin)) {
    resolved.$nin = await Promise.all(resolved.$nin.map((item) => resolveListItemObjectId(fieldName, item)));
  }

  return resolved;
}

async function resolveTicketFilterReferences(filter) {
  if (!filter || typeof filter !== 'object') return filter;
  if (Array.isArray(filter)) {
    const out = [];
    for (const item of filter) out.push(await resolveTicketFilterReferences(item));
    return out;
  }

  const out = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$and' || key === '$or' || key === '$nor') {
      out[key] = await resolveTicketFilterReferences(value);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(TICKET_LIST_FIELD_MAP, key)) {
      out[key] = await resolveReferenceValue(key, value);
      continue;
    }

    if (value && typeof value === 'object') {
      out[key] = await resolveTicketFilterReferences(value);
      continue;
    }

    out[key] = value;
  }

  return out;
}

async function normalizeDynamicQueryForExecution(dynamicQuery) {
  if (!dynamicQuery || dynamicQuery.collection !== 'tickets') return dynamicQuery;

  if (dynamicQuery.operation === 'find') {
    return {
      ...dynamicQuery,
      filter: await resolveTicketFilterReferences(dynamicQuery.filter || {}),
    };
  }

  if (dynamicQuery.operation === 'aggregate') {
    const pipeline = Array.isArray(dynamicQuery.pipeline) ? dynamicQuery.pipeline : [];
    const normalizedPipeline = [];

    for (const stage of pipeline) {
      if (stage && typeof stage === 'object' && !Array.isArray(stage) && stage.$match) {
        normalizedPipeline.push({
          ...stage,
          $match: await resolveTicketFilterReferences(stage.$match),
        });
      } else {
        normalizedPipeline.push(stage);
      }
    }

    return {
      ...dynamicQuery,
      pipeline: normalizedPipeline,
    };
  }

  return dynamicQuery;
}

function getModelByCollection(collection) {
  if (collection === 'tickets') return TicketModel;
  return null;
}

async function executeDynamicQuery(dynamicQuery) {
  const normalizedQuery = await normalizeDynamicQueryForExecution(dynamicQuery);
  const model = getModelByCollection(normalizedQuery.collection);

  if (!model) {
    throw new Error(`DYNAMIC_QUERY_MODEL_NOT_AVAILABLE:${normalizedQuery.collection}`);
  }

  if (normalizedQuery.operation === 'find') {
    return await model
      .find(normalizedQuery.filter || {})
      .maxTimeMS(AI_DB_TIMEOUT_MS)
      .sort(normalizedQuery.sort || { createdAt: -1 })
      .select(normalizedQuery.projection || {})
      .limit(Math.max(Number(normalizedQuery.limit) || 10, 1))
      .lean();
  }

  if (normalizedQuery.operation === 'aggregate') {
    return await model
      .aggregate(normalizedQuery.pipeline || [])
      .option({ maxTimeMS: AI_DB_TIMEOUT_MS });
  }

  throw new Error(`DYNAMIC_QUERY_OPERATION_NOT_IMPLEMENTED:${normalizedQuery.operation}`);
}

/* =========================
   FINAL INTENT RESOLVER
========================= */

function resolveFinalIntent({ llm, fallback, question }) {
  const signals = getQuestionSignals(question);
  const semanticText = `${signals.q || ''} ${signals.qNormalized || ''}`;
  const closureRankingGuardrail =
    llm?.queryType === 'last_tickets' &&
    includesAny(semanticText, ['agente', 'agentes', 'quien', 'quién', 'kien']) &&
    includesAny(semanticText, ['cerro', 'cerró', 'cerrad', 'cerrar', 'resolv', 'cerrao', 'serro', 'serrao']) &&
    includesAny(semanticText, ['mas', 'más', 'top', 'mayor']) &&
    !includesAny(semanticText, ['ultimo ticket', 'último ticket']);

  if (signals.asksTicketAssigneeByCode && signals.ticketCode) {
    return {
      queryType: 'ticket_assignee_by_code',
      ticketCode: signals.ticketCode,
      timeRange: 'all',
      limit: 1,
      daysBack: null,
    };
  }

  if (signals.asksLastClosedTicket) {
    return { queryType: 'last_closed_ticket_detail', timeRange: 'all', limit: 1, daysBack: null };
  }

  if (signals.mentionsReporter) {
    return { queryType: 'last_ticket_detail', timeRange: 'all', limit: 1, daysBack: null };
  }

  if (signals.mentionsTopClosers || closureRankingGuardrail) {
    return { ...fallback, queryType: 'top_closers', limit: Math.max(Number(fallback.limit) || 5, 5) };
  }

  if (signals.mentionsTopReporters) {
    return { ...fallback, queryType: 'top_reporters', limit: Math.max(Number(fallback.limit) || 5, 5) };
  }

  if (signals.mentionsTrend) {
    return { ...fallback, queryType: 'trend_summary', limit: 5 };
  }

  if (llm?.queryType && llm.queryType !== 'last_tickets') {
    return {
      ...fallback,
      ...llm,
      limit: Number(llm.limit || fallback.limit || 5),
      daysBack: llm.daysBack ?? fallback.daysBack ?? null,
      timeRange: llm.timeRange || fallback.timeRange || 'this_week',
    };
  }

  return fallback;
}

/* =========================
   DATA QUERIES
========================= */

async function getLastTickets(limit, timeRange = 'all', daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  return await TicketModel.find({
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .maxTimeMS(AI_DB_TIMEOUT_MS)
    .select('code subject description createdAt updatedAt priority department type status')
    .sort({ createdAt: -1 })
    .limit(Math.max(Number(limit) || 5, 1))
    .lean();
}

async function getLastTicketDetail() {
  return await TicketModel.findOne()
    .maxTimeMS(AI_DB_TIMEOUT_MS)
    .select('code subject description createdAt updatedAt requester')
    .populate('requester', 'name email')
    .sort({ createdAt: -1 })
    .lean();
}

async function getLastClosedTicketDetail() {
  return await TicketModel.findOne({
    closedBy: { $exists: true, $ne: null },
  })
    .maxTimeMS(AI_DB_TIMEOUT_MS)
    .select('code subject description closedAt updatedAt closedBy')
    .populate('closedBy', 'name email')
    .sort({ closedAt: -1, updatedAt: -1 })
    .lean();
}

async function getTicketAssigneeByCode(ticketCode) {
  return await TicketModel.findOne({ code: ticketCode })
    .maxTimeMS(AI_DB_TIMEOUT_MS)
    .select('code subject assignedTo updatedAt')
    .populate('assignedTo', 'name email')
    .lean();
}

async function getTopReporters(limit, timeRange = 'this_week', daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  return await TicketModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    { $group: { _id: '$requester', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: Math.max(Number(limit) || 5, 1) },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        requesterId: '$_id',
        count: 1,
        name: { $ifNull: ['$user.name', 'Usuario no identificado'] },
        email: { $ifNull: ['$user.email', null] },
      },
    },
  ]).option({ maxTimeMS: AI_DB_TIMEOUT_MS });
}

async function getTopClosers(limit, timeRange = 'this_week', daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);

  return await TicketModel.aggregate([
    {
      $match: {
        closedBy: { $exists: true, $ne: null },
        closedAt: { $gte: startDate, $lte: endDate },
      },
    },
    { $group: { _id: '$closedBy', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: Math.max(Number(limit) || 5, 1) },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        agentId: '$_id',
        count: 1,
        name: { $ifNull: ['$user.name', 'Agente no identificado'] },
        email: { $ifNull: ['$user.email', null] },
      },
    },
  ]).option({ maxTimeMS: AI_DB_TIMEOUT_MS });
}

async function getTrendSummary(timeRange = 'this_week', daysBack = null) {
  const { startDate, endDate } = getDateRange(timeRange, daysBack);
  const durationMs = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  const [currentCount, previousCount, activeLists] = await Promise.all([
    TicketModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }).maxTimeMS(AI_DB_TIMEOUT_MS),
    TicketModel.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }).maxTimeMS(AI_DB_TIMEOUT_MS),
    List.countDocuments({ isDeleted: false }).maxTimeMS(AI_DB_TIMEOUT_MS).catch(() => 0),
  ]);

  const diff = currentCount - previousCount;
  const trend = diff > 0 ? 'alza' : diff < 0 ? 'baja' : 'estable';

  return {
    currentCount,
    previousCount,
    trend,
    activeLists,
  };
}

/* =========================
   ANALYTICS CORE
========================= */

async function generateAnalyticsResponse(params) {
  if (params?.queryType === 'dynamic_query' && params?.dynamicQuery) {
    const data = await executeDynamicQuery(params.dynamicQuery);
    return {
      type: 'dynamic_query',
      data,
      dynamicQuery: params.dynamicQuery,
    };
  }

  switch (params.queryType) {
    case 'last_tickets':
      return {
        type: 'last_tickets',
        data: await getLastTickets(params.limit, params.timeRange, params.daysBack),
      };

    case 'last_ticket_detail':
      return {
        type: 'last_ticket_detail',
        data: await getLastTicketDetail(),
      };

    case 'last_closed_ticket_detail':
      return {
        type: 'last_closed_ticket_detail',
        data: await getLastClosedTicketDetail(),
      };

    case 'ticket_assignee_by_code':
      return {
        type: 'ticket_assignee_by_code',
        data: await getTicketAssigneeByCode(params.ticketCode),
      };

    case 'top_reporters':
      return {
        type: 'top_reporters',
        data: await getTopReporters(params.limit, params.timeRange, params.daysBack),
      };

    case 'top_closers':
      return {
        type: 'top_closers',
        data: await getTopClosers(params.limit, params.timeRange, params.daysBack),
      };

    case 'trend_summary':
      return {
        type: 'trend_summary',
        data: await getTrendSummary(params.timeRange, params.daysBack),
      };

    default:
      return { type: 'unknown' };
  }
}

/* =========================
   DETERMINISTIC RESPONSE
========================= */

function buildDeterministicAnswer(question, analytics) {
  if (analytics.type === 'dynamic_query') {
    const rows = Array.isArray(analytics.data) ? analytics.data : [];
    if (!rows.length) return 'No encontré resultados para esa consulta.';

    const first = rows[0] || {};
    const firstEntries = Object.entries(first);
    if (firstEntries.length === 1 && typeof firstEntries[0][1] === 'number') {
      const [metricName, metricValue] = firstEntries[0];
      return `Resultado: ${metricName} = ${metricValue}.`;
    }

    const sample = rows.slice(0, 3).map((row) => {
      if (row?.name && typeof row.count !== 'undefined') {
        return `${row.name}: ${row.count}`;
      }

      if (row?._id && typeof row.count !== 'undefined') {
        return `${String(row._id)}: ${row.count}`;
      }

      if (row?.code) {
        return `${row.code} - ${row.subject || 'sin asunto'}`;
      }

      return JSON.stringify(row);
    }).join('; ');

    return `Encontré ${rows.length} resultados. Muestra: ${sample}`;
  }

  if (analytics.type === 'last_ticket_detail') {
    const subject = analytics.data?.subject || 'sin asunto';
    const code = analytics.data?.code ? ` (${analytics.data.code})` : '';
    return `El último ticket${code} es "${subject}".`;
  }

  if (analytics.type === 'last_closed_ticket_detail') {
    const ticket = analytics.data;
    if (!ticket) return 'No encontré tickets cerrados para responder esa consulta.';

    const closerName = ticket?.closedBy?.name || 'Agente no identificado';
    const closerEmail = ticket?.closedBy?.email ? ` (${ticket.closedBy.email})` : '';
    const code = ticket?.code ? ` (${ticket.code})` : '';
    return `El último ticket cerrado${code} fue gestionado por ${closerName}${closerEmail}.`;
  }

  if (analytics.type === 'ticket_assignee_by_code') {
    const ticket = analytics.data;
    if (!ticket) return 'No encontré ese ticket para validar su asignación.';

    const assigneeName = ticket?.assignedTo?.name || 'Sin agente asignado';
    const assigneeEmail = ticket?.assignedTo?.email ? ` (${ticket.assignedTo.email})` : '';
    return `El ticket ${ticket.code || ''} está asignado a ${assigneeName}${assigneeEmail}.`.trim();
  }

  if (analytics.type === 'top_reporters') {
    const top = analytics.data?.[0];
    if (!top) return 'No encontré reportantes en el período consultado.';
    return `El usuario que más reportó fue ${top.name || 'N/D'} con ${top.count || 0} tickets.`;
  }

  if (analytics.type === 'top_closers') {
    const top = analytics.data?.[0];
    if (!top) return 'No encontré agentes que hayan cerrado tickets en el período consultado.';
    return `El agente que más cerró tickets fue ${top.name || 'N/D'} con ${top.count || 0} cierres.`;
  }

  if (analytics.type === 'trend_summary') {
    const current = Number(analytics.data?.currentCount || 0);
    const previous = Number(analytics.data?.previousCount || 0);
    const trend = analytics.data?.trend || 'estable';
    return `Se registran ${current} tickets en el período actual vs ${previous} en el anterior, con tendencia ${trend}.`;
  }

  if (analytics.type === 'last_tickets') {
    const count = analytics.data?.length || 0;
    if (!count) return 'No encontré tickets en el período consultado.';
    const first = analytics.data[0];
    return `Se encontraron ${count} tickets. El más reciente es ${first?.code || 'sin código'}: ${first?.subject || 'sin asunto'}.`;
  }

  return 'Procesé tu consulta.';
}

/* =========================
   LLM RESPONSE
========================= */

async function improveWithLLM(question, digest) {
  try {
    const result = await generateWithModelFallback(
      RESPONDER_MODELS,
      (model) => ({
        model,
        prompt: `Eres analista senior.\n\nPregunta: ${question}\nDatos: ${JSON.stringify(digest)}\n\nDa insight claro en 2 líneas.`,
        stream: false,
      }),
      'improve_response'
    );

    if (!result.ok) {
      console.warn('[AI Analytics] RESPONDER_ALL_FAILED', { errors: result.errors });
      return null;
    }

    return {
      text: result.data?.response?.trim() || null,
      model: result.model,
      provider: result.provider,
    };
  } catch {
    return null;
  }
}

/* =========================
   MAIN ENTRY
========================= */

export async function askAnalytics(question) {
  return askAnalyticsWithProgress(question);
}

async function askAnalyticsWithProgress(question, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const startedAt = Date.now();

  console.log('[AI Analytics] START', {
    at: new Date().toISOString(),
    question,
  });

  const emit = (stage, payload = {}) => {
    const eventPayload = {
      stage,
      ts: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      ...payload,
    };

    console.log('[AI Analytics] STAGE', eventPayload);
    if (!onProgress) return;
    onProgress(eventPayload);
  };

  try {
    // =========================
    // 1. INTERPRETACIÓN (SMART)
    // =========================
    emit('interpreting', { message: 'Interpretando intención de la consulta.' });

    const signals = getQuestionSignals(question);
    let llm = null;

    const isDirectIntent =
      signals.asksTicketAssigneeByCode ||
      signals.mentionsTopReporters ||
      signals.mentionsTopClosers ||
      signals.asksLastClosedTicket ||
      signals.mentionsTrend ||
      signals.mentionsReporter ||
      signals.asksLastTickets;

    if (!isDirectIntent) {
      console.log('[AI] USING_LLM_INTERPRETATION', { question });

      emit('interpreting_llm', {
        message: 'Consultando modelo de IA...'
      });

      llm = await interpretQuestion(question);
    } else {
      console.log('[AI] USING_HEURISTICS_ONLY', { question });
    }

    // =========================
    // 2. RESOLVER INTENCIÓN
    // =========================
    emit('resolving_intent', { message: 'Resolviendo intención final.' });

    const fallback = fallbackInterpretQuestion(question);
    const params = resolveFinalIntent({ llm, fallback, question });
    const llmUnsupportedQueryType = llm?.queryType && !KNOWN_QUERY_TYPES.has(String(llm.queryType));

    const shouldTryDynamicPlanner =
      !isDirectIntent &&
      (!llm?.queryType || llm.queryType === 'last_tickets' || !KNOWN_QUERY_TYPES.has(String(llm.queryType)));

    if (shouldTryDynamicPlanner) {
      emit('planning_query', { message: 'Planificando consulta dinámica segura.' });
      const planned = await planDynamicQuery(question);

      if (planned.ok) {
        params.queryType = 'dynamic_query';
        params.dynamicQuery = planned.query;
        params.__dynamicPlannerModel = planned.model || null;
        params.__dynamicPlannerProvider = planned.provider || null;
      } else {
        console.warn('[AI Analytics] DYNAMIC_PLANNER_SKIPPED', {
          reason: planned.reason,
          errors: planned.errors,
        });

        if (llmUnsupportedQueryType) {
          params.queryType = fallback.queryType;
          params.timeRange = fallback.timeRange;
          params.limit = fallback.limit;
          params.daysBack = fallback.daysBack;
        }
      }
    }

    // =========================
    // 3. CONSULTA A BD
    // =========================
    emit('querying_data', {
      message: 'Consultando datos de tickets.',
      queryType: params.queryType,
      timeRange: params.timeRange,
      limit: params.limit,
    });

    assertMongoConnected();

    const analytics = await withTimeout(
      generateAnalyticsResponse(params),
      AI_DB_TIMEOUT_MS + 2000,
      'QUERYING_DATA'
    );

    console.log('[AI Analytics] DATA_READY', {
      queryType: analytics.type,
      elapsedMs: Date.now() - startedAt,
    });

    // =========================
    // 4. RESPUESTA BASE
    // =========================
    emit('building_answer', { message: 'Construyendo respuesta base.' });

    let answer = buildDeterministicAnswer(question, analytics);
    let llmSummaryUsed = false;

    // =========================
    // 5. MEJORA CON LLM (OPCIONAL)
    // =========================
    emit('generating_response', {
      message: 'Mejorando redacción con IA (opcional)...'
    });

    let improved = null;

    try {
      improved = await improveWithLLM(question, analytics);
    } catch (err) {
      console.warn('[AI] LLM improve failed:', err.message);
    }

    const improvedText = improved?.text || null;

    if (improvedText && improvedText.length > 30) {
      answer = improvedText;
      llmSummaryUsed = true;

      console.log('[AI Analytics] LLM_RESPONSE_ACCEPTED', {
        elapsedMs: Date.now() - startedAt,
        model: improved?.model || null,
        provider: improved?.provider || null,
      });
    } else {
      console.log('[AI Analytics] USING_DETERMINISTIC_RESPONSE', {
        elapsedMs: Date.now() - startedAt,
      });
    }

    // =========================
    // 6. META
    // =========================
    const confidence = llmSummaryUsed ? 0.85 : 0.72;
    const passedConfidence = confidence >= AI_MIN_CONFIDENCE;

    emit('completed', {
      message: 'Análisis completado.',
      queryType: analytics.type,
      llmSummaryUsed,
      confidence,
      totalMs: Date.now() - startedAt,
    });

    return {
      success: true,
      question,
      params,
      analytics,
      answer,
      agentResponse: answer,
      meta: {
        llmSummaryUsed,
        confidence,
        passedConfidence,
        interpreterModelUsed: llm?.__interpreterModel || null,
        interpreterProvider: llm?.__interpreterProvider || null,
        dynamicPlannerModelUsed: params.__dynamicPlannerModel || null,
        dynamicPlannerProvider: params.__dynamicPlannerProvider || null,
        responderModelUsed: llmSummaryUsed ? improved?.model || null : null,
        responderProvider: llmSummaryUsed ? improved?.provider || null : null,
      },
    };

  } catch (error) {
    console.error('[AI Analytics] FAILED', {
      error: error.message,
      elapsedMs: Date.now() - startedAt,
    });

    emit('failed', {
      message: 'Falló el procesamiento de la consulta.',
      error: error.message,
      totalMs: Date.now() - startedAt,
    });

    return {
      success: false,
      error: 'Error procesando la consulta',
      details: error.message,
    };
  }
}
export { askAnalyticsWithProgress };

export default {
  askAnalytics,
  askAnalyticsWithProgress,
};
