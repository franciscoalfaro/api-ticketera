import "isomorphic-fetch";
import List from "../list/list.model.js";

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_LIST_CACHE_TTL_MS = 60000;

const getEnvBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const LIST_CACHE_TTL_MS = toPositiveNumber(process.env.AI_LIST_CACHE_TTL_MS, DEFAULT_LIST_CACHE_TTL_MS);

let classificationListsCache = {
  expiresAt: 0,
  data: null,
};

const extractJson = (text) => {
  if (!text) return null;

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch (_) {
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_) {
    }
  }

  return null;
};

const postWithTimeout = async (url, body, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM HTTP ${response.status}: ${text || response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const pickOptionByKeywords = (options = [], keywords = []) => {
  const normalizedOptions = options.map((option) => normalize(option));

  for (const keyword of keywords) {
    const index = normalizedOptions.findIndex((option) => option.includes(normalize(keyword)));
    if (index !== -1) return options[index];
  }

  return options[0] || null;
};

const buildFewShotExamples = (options) => {
  const highPriority = pickOptionByKeywords(options.priority, ["alta", "high", "crit", "urg"]);
  const mediumPriority = pickOptionByKeywords(options.priority, ["media", "medium", "normal"]);
  const lowPriority = pickOptionByKeywords(options.priority, ["baja", "low"]);

  const securityDepartment = pickOptionByKeywords(options.department, ["seguridad", "security"]);
  const infraDepartment = pickOptionByKeywords(options.department, ["infra", "network", "red", "soporte", "it"]);
  const appsDepartment = pickOptionByKeywords(options.department, ["aplic", "sistema", "software", "desarrollo"]);

  const incidentType = pickOptionByKeywords(options.type, ["incidente", "incident", "falla", "error"]);
  const requestType = pickOptionByKeywords(options.type, ["solicitud", "request", "requerimiento"]);
  const accessType = pickOptionByKeywords(options.type, ["acceso", "permiso", "credencial"]);

  const highImpact = pickOptionByKeywords(options.impact, ["alto", "high", "masivo", "global"]);
  const mediumImpact = pickOptionByKeywords(options.impact, ["medio", "medium"]);
  const lowImpact = pickOptionByKeywords(options.impact, ["bajo", "low"]);

  return [
    {
      email: {
        subject: "No podemos ingresar al ERP, toda el área está detenida",
        body: "Desde las 08:00 nadie del área de finanzas puede acceder al ERP. Aparece error 500.",
      },
      output: {
        priority: highPriority,
        department: appsDepartment,
        type: incidentType,
        impact: highImpact,
        confidence: 0.92,
        summary: "Falla masiva de acceso al ERP que afecta la operación del área.",
      },
    },
    {
      email: {
        subject: "Solicitud de creación de usuario nuevo",
        body: "Necesitamos crear cuenta para colaborador que ingresa mañana en RRHH.",
      },
      output: {
        priority: mediumPriority,
        department: appsDepartment,
        type: requestType,
        impact: lowImpact,
        confidence: 0.86,
        summary: "Solicitud administrativa de alta de usuario para nuevo colaborador.",
      },
    },
    {
      email: {
        subject: "Posible phishing en correo corporativo",
        body: "Recibimos correo sospechoso solicitando claves y varios usuarios hicieron clic.",
      },
      output: {
        priority: highPriority,
        department: securityDepartment || infraDepartment,
        type: incidentType,
        impact: highImpact,
        confidence: 0.95,
        summary: "Incidente de seguridad potencial por campaña de phishing.",
      },
    },
    {
      email: {
        subject: "Necesito acceso VPN para trabajo remoto",
        body: "Me incorporé al equipo comercial y requiero acceso VPN para conectarme desde casa.",
      },
      output: {
        priority: lowPriority || mediumPriority,
        department: infraDepartment,
        type: accessType || requestType,
        impact: mediumImpact,
        confidence: 0.82,
        summary: "Solicitud de habilitación de acceso remoto VPN para un usuario.",
      },
    },
  ];
};

const buildPrompt = ({ subject, html, options }) => {
  const fewShotExamples = buildFewShotExamples(options);

  return `Eres un clasificador experto de tickets de soporte TI para mesa de ayuda corporativa.

OBJETIVO:
- Analizar el correo entrante y clasificarlo en: priority, department, type, impact.
- Responder SOLO JSON válido y estricto.

REGLAS DE NEGOCIO:
- Debes elegir SOLO valores existentes en las listas permitidas.
- Si no hay evidencia suficiente para un campo, usa null en ese campo.
- Si el correo sugiere caída masiva, operación detenida, riesgo de seguridad o múltiples usuarios afectados, aumenta priority e impact.
- Si es una solicitud administrativa o de acceso individual sin urgencia, reduce priority e impact.
- No inventes categorías ni sinónimos fuera de las listas.

LISTAS PERMITIDAS:
- priority: ${JSON.stringify(options.priority)}
- department: ${JSON.stringify(options.department)}
- type: ${JSON.stringify(options.type)}
- impact: ${JSON.stringify(options.impact)}

EJEMPLOS (few-shot):
${JSON.stringify(fewShotExamples, null, 2)}

FORMATO DE RESPUESTA (OBLIGATORIO):
{
  "priority": "<valor exacto o null>",
  "department": "<valor exacto o null>",
  "type": "<valor exacto o null>",
  "impact": "<valor exacto o null>",
  "confidence": 0.0,
  "summary": "<una frase breve, concreta y útil para agentes>"
}

RESTRICCIONES DE SALIDA:
- NO markdown.
- NO texto adicional.
- SOLO un objeto JSON.
- confidence debe estar entre 0 y 1.

CORREO A CLASIFICAR:
Asunto: ${subject || "Sin asunto"}
Cuerpo (HTML crudo): ${html || ""}`;
};

const isAllowed = (value, allowed) => {
  if (value === null || value === undefined) return false;
  return allowed.map(normalize).includes(normalize(value));
};

const getListByNames = (lists, names) => {
  const normalizedNames = names.map((name) => name.toLowerCase());
  return lists.find((list) => normalizedNames.includes((list.name || "").toLowerCase()));
};

const getValueToIdMap = (list) => {
  const map = new Map();
  if (!list?.items?.length) return map;

  for (const item of list.items) {
    const key = String(item.value || "").trim().toLowerCase();
    if (key) map.set(key, item._id);
  }

  return map;
};

const getClassificationLists = async () => {
  const now = Date.now();
  if (classificationListsCache.data && classificationListsCache.expiresAt > now) {
    return classificationListsCache.data;
  }

  const lists = await List.find({
    name: { $in: ["Prioridades", "Impacto", "Departamentos", "Tipos de Ticket"] },
    isDeleted: false,
  }).lean();

  const data = {
    priorityList: getListByNames(lists, ["Prioridades"]),
    impactList: getListByNames(lists, ["Impacto"]),
    departmentList: getListByNames(lists, ["Departamentos"]),
    typeList: getListByNames(lists, ["Tipos de Ticket"]),
  };

  if (LIST_CACHE_TTL_MS > 0) {
    classificationListsCache = {
      data,
      expiresAt: now + LIST_CACHE_TTL_MS,
    };
  }

  return data;
};

export const classifyIncomingEmail = async ({
  subject,
  html,
  options,
}) => {
  const enabled = getEnvBool(process.env.AI_TICKET_CLASSIFIER_ENABLED, false);

  if (!enabled) {
    return {
      enabled: false,
      applied: false,
      reason: "AI_TICKET_CLASSIFIER_ENABLED=false",
    };
  }

  const model = process.env.AI_OLLAMA_MODEL || "qwen2.5:14b-instruct";
  const baseUrl = process.env.AI_OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const minConfidence = Number(process.env.AI_MIN_CONFIDENCE || "0.7");
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  const prompt = buildPrompt({ subject, html, options });

  try {
    const payload = {
      model,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
      },
    };

    const data = await postWithTimeout(`${baseUrl}/api/generate`, payload, timeoutMs);
    const raw = data?.response || "";
    const parsed = extractJson(raw);

    if (!parsed || typeof parsed !== "object") {
      return {
        enabled: true,
        applied: false,
        reason: "invalid_json_response",
      };
    }

    const confidence = Number(parsed.confidence ?? 0);

    const result = {
      priority: isAllowed(parsed.priority, options.priority) ? normalize(parsed.priority) : null,
      department: isAllowed(parsed.department, options.department) ? normalize(parsed.department) : null,
      type: isAllowed(parsed.type, options.type) ? normalize(parsed.type) : null,
      impact: isAllowed(parsed.impact, options.impact) ? normalize(parsed.impact) : null,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      summary: parsed.summary ? String(parsed.summary).trim() : null,
    };

    if (result.confidence < minConfidence) {
      return {
        enabled: true,
        applied: false,
        reason: "low_confidence",
        classification: result,
      };
    }

    return {
      enabled: true,
      applied: true,
      classification: result,
    };
  } catch (error) {
    return {
      enabled: true,
      applied: false,
      reason: error.message,
    };
  }
};

export const classifyEmailForCatalog = async ({ subject, html }) => {
  const {
    priorityList,
    impactList,
    departmentList,
    typeList,
  } = await getClassificationLists();

  const aiResult = await classifyIncomingEmail({
    subject,
    html,
    options: {
      priority: (priorityList?.items || []).map((item) => item.value),
      impact: (impactList?.items || []).map((item) => item.value),
      department: (departmentList?.items || []).map((item) => item.value),
      type: (typeList?.items || []).map((item) => item.value),
    },
  });

  const priorityMap = getValueToIdMap(priorityList);
  const impactMap = getValueToIdMap(impactList);
  const departmentMap = getValueToIdMap(departmentList);
  const typeMap = getValueToIdMap(typeList);

  const classification = aiResult.classification || {};

  return {
    aiResult,
    matched: {
      priority: classification.priority ? { value: classification.priority, id: priorityMap.get(classification.priority) || null } : null,
      impact: classification.impact ? { value: classification.impact, id: impactMap.get(classification.impact) || null } : null,
      department: classification.department ? { value: classification.department, id: departmentMap.get(classification.department) || null } : null,
      type: classification.type ? { value: classification.type, id: typeMap.get(classification.type) || null } : null,
    },
  };
};

export const resolveTicketClassificationFromEmail = async ({
  subject,
  html,
  defaults,
}) => {
  const { aiResult, matched } = await classifyEmailForCatalog({ subject, html });

  const resolvedPriority = aiResult.applied && matched.priority?.id ? matched.priority.id : defaults.priority;
  const resolvedImpact = aiResult.applied && matched.impact?.id ? matched.impact.id : defaults.impact;
  const resolvedDepartment = aiResult.applied && matched.department?.id ? matched.department.id : defaults.department;
  const resolvedType = aiResult.applied && matched.type?.id ? matched.type.id : defaults.type;

  return {
    resolvedPriority,
    resolvedImpact,
    resolvedDepartment,
    resolvedType,
    aiResult,
  };
};
