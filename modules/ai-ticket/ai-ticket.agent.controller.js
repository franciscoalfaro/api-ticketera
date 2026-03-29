import { askAnalytics, askAnalyticsWithProgress } from './ai-ticket.analytics.service.js';
import { createLog } from '../logs/logs.service.js';

const AI_STREAM_MAX_MS = Math.max(Number.parseInt(process.env.AI_STREAM_MAX_MS || '120000', 10) || 120000, 15000);
const AI_STAGE_STALL_MS = Math.max(Number.parseInt(process.env.AI_STAGE_STALL_MS || '45000', 10) || 45000, 10000);

const sendSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const getSseLogStatus = (event, payload = {}) => {
  if (event === 'error') return 'error';
  if (event === 'warning') return 'warning';
  if (event === 'done') return payload?.success ? 'success' : 'warning';
  if (event === 'result' || event === 'timeline') return 'success';
  return 'info';
};

const buildSseLogDescription = (event, payload = {}) => {
  if (event === 'progress') {
    return `SSE progress stage=${payload?.stage || 'unknown'} elapsedMs=${payload?.elapsedMs ?? 'n/a'}`;
  }

  if (event === 'timeline') {
    return `SSE timeline success=${payload?.success ?? false} totalMs=${payload?.totalMs ?? 'n/a'} queryType=${payload?.queryType || 'n/a'}`;
  }

  if (event === 'result') {
    return `SSE result success=${payload?.success ?? false} queryType=${payload?.analytics?.type || 'n/a'} question="${payload?.question || ''}"`;
  }

  if (event === 'done') {
    return `SSE done success=${payload?.success ?? false}`;
  }

  if (event === 'error') {
    return `SSE error code=${payload?.code || 'STREAM_ERROR'} detail=${payload?.details || payload?.error || 'n/a'}`;
  }

  if (event === 'warning') {
    return `SSE warning code=${payload?.code || 'warning'} message=${payload?.message || 'n/a'}`;
  }

  return `SSE event=${event}`;
};

/**
 * POST /api/ai-ticket/ask
 * Agente IA de reportería que responde preguntas sobre tickets
 */
export async function askAgent(req, res) {
  try {
    const { question } = req.body;
    console.log('Pregunta recibida:', question);
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campo "question" requerido y debe ser texto no vacío',
      });
    }

    // Log de la pregunta
    const userId = req.user?.id || req.user?._id || null;
    await createLog({
      action: 'AI_AGENT_QUESTION',
      description: `Pregunta al agente IA: "${question}"`,
      user: userId,
      timestamp: new Date(),
    });

    // Procesar pregunta
    const result = await askAnalytics(question);

    if (!result.success) {
      await createLog({
        action: 'AI_AGENT_ERROR',
        description: `Error en consulta: ${result.error}`,
        user: userId,
      });

      return res.status(400).json(result);
    }

    // Log exitoso
    await createLog({
      action: 'AI_AGENT_SUCCESS',
      description: `Análisis completado. Tipo: ${result.analytics.type}`,
      user: userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[AI Agent] Error:', error);
    await createLog({
      action: 'AI_AGENT_EXCEPTION',
      description: `Excepción: ${error.message}`,
      user: req.user?.id || req.user?._id || null,
    });

    return res.status(500).json({
      success: false,
      error: 'Error procesando la pregunta',
      details: error.message,
    });
  }
}

/**
 * POST /api/ai-ticket/ask-stream
 * Agente IA en tiempo real vía SSE
 */
export async function askAgentStream(req, res) {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Campo "question" requerido y debe ser texto no vacío',
    });
  }

  const userId = req.user?.id || req.user?._id || null;
  let closed = false;
  const streamStartedAt = Date.now();
  let slowWarningSent = false;
  let stallWarningSent = false;
  let lastProgressAt = Date.now();
  let lastStage = 'received';

  const emitSse = (event, payload, options = {}) => {
    const shouldLog = options.log !== false;
    sendSseEvent(res, event, payload);

    if (!shouldLog) return;

    createLog({
      action: 'AI_AGENT_STREAM_EVENT',
      module: 'ai-ticket',
      description: buildSseLogDescription(event, payload),
      user: userId,
      method: event,
      status: getSseLogStatus(event, payload),
      ip: req.clientIp || req.ip || null,
    }).catch((error) => {
      console.warn('[AI Stream] createLog EVENT failed:', error.message);
    });
  };

  console.log('[AI Stream] START', {
    at: new Date().toISOString(),
    question,
    userId,
  });

  req.on('aborted', () => {
    closed = true;
    console.log('[AI Stream] CLIENT_ABORTED', {
      elapsedMs: Date.now() - streamStartedAt,
    });
  });

  res.on('close', () => {
    console.log('[AI Stream] RESPONSE_CLOSE_EVENT', {
      elapsedMs: Date.now() - streamStartedAt,
      writableEnded: res.writableEnded,
      destroyed: res.destroyed,
    });
  });

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const heartbeat = setInterval(() => {
    if (!closed) {
      console.log('[AI Stream] HEARTBEAT', { elapsedMs: Date.now() - streamStartedAt });
      emitSse('ping', { ts: new Date().toISOString() }, { log: false });
    }
  }, 15000);

  const slowWatchdog = setInterval(() => {
    if (closed || slowWarningSent) return;
    const elapsedMs = Date.now() - streamStartedAt;
    if (elapsedMs >= 15000) {
      slowWarningSent = true;
      console.warn('[AI Stream] SLOW_ANALYSIS', { elapsedMs });
      emitSse('warning', {
        code: 'SLOW_ANALYSIS',
        message: 'La consulta está tardando más de lo normal, seguimos procesando.',
        elapsedMs,
      });
    }
  }, 3000);

  const stageWatchdog = setInterval(() => {
    if (closed || stallWarningSent) return;
    const withoutProgressMs = Date.now() - lastProgressAt;
    if (withoutProgressMs >= AI_STAGE_STALL_MS) {
      stallWarningSent = true;
      console.warn('[AI Stream] STAGE_STALLED', { lastStage, withoutProgressMs });
      emitSse('warning', {
        code: 'STAGE_STALLED',
        message: `Sin progreso en etapa "${lastStage}" por más de ${Math.round(withoutProgressMs / 1000)}s.`,
        lastStage,
        withoutProgressMs,
      });
    }
  }, 5000);

  try {
    console.log('[AI Stream] STAGE received');
    emitSse('status', {
      stage: 'received',
      message: 'Pregunta recibida, iniciando análisis.',
    }, { log: false });

    createLog({
      action: 'AI_AGENT_QUESTION_STREAM',
      module: 'ai-ticket',
      description: `Pregunta streaming al agente IA: "${question}"`,
      user: userId,
      method: 'status',
      status: 'info',
      ip: req.clientIp || req.ip || null,
      timestamp: new Date(),
    }).catch((error) => {
      console.warn('[AI Stream] createLog QUESTION_STREAM failed:', error.message);
    });

    if (closed) return;

    console.log('[AI Stream] STAGE analyzing');
    emitSse('status', {
      stage: 'analyzing',
      message: 'Analizando la consulta y preparando respuesta.',
    }, { log: false });
    lastProgressAt = Date.now();
    lastStage = 'analyzing';

    const timeoutError = new Error('STREAM_TIMEOUT');
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(timeoutError), AI_STREAM_MAX_MS);
    });

    let result;
    try {
      result = await Promise.race([
        askAnalyticsWithProgress(question, {
          onProgress: (progress) => {
            if (closed) return;
            lastProgressAt = Date.now();
            lastStage = progress?.stage || lastStage;
            stallWarningSent = false;
            console.log('[AI Stream] PROGRESS', progress);
            emitSse('progress', progress);
          },
        }),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (closed) return;

    console.log('[AI Stream] RESULT_READY', {
      success: result.success,
      analyticsType: result.analytics?.type,
      elapsedMs: Date.now() - streamStartedAt,
    });

    if (!result.success) {
      createLog({
        action: 'AI_AGENT_STREAM_ERROR',
        module: 'ai-ticket',
        description: `Error en consulta streaming: ${result.error}`,
        user: userId,
        method: 'error',
        status: 'error',
        ip: req.clientIp || req.ip || null,
      }).catch((error) => {
        console.warn('[AI Stream] createLog STREAM_ERROR failed:', error.message);
      });

      emitSse('error', {
        success: false,
        error: result.error,
        details: result.details || null,
      });
      emitSse('done', { success: false });
      return;
    }

    createLog({
      action: 'AI_AGENT_STREAM_SUCCESS',
      module: 'ai-ticket',
      description: `Análisis streaming completado. Tipo: ${result.analytics?.type}`,
      user: userId,
      method: 'done',
      status: 'success',
      ip: req.clientIp || req.ip || null,
    }).catch((error) => {
      console.warn('[AI Stream] createLog STREAM_SUCCESS failed:', error.message);
    });

    emitSse('timeline', {
      totalMs: Date.now() - streamStartedAt,
      success: true,
      queryType: result.analytics?.type || null,
    });

    emitSse('result', result);
    emitSse('done', { success: true });
    console.log('[AI Stream] DONE success', { elapsedMs: Date.now() - streamStartedAt });
  } catch (error) {
    console.error('[AI Agent Stream] Error:', error);

    const isTimeout = error?.message === 'STREAM_TIMEOUT';

    createLog({
      action: 'AI_AGENT_STREAM_EXCEPTION',
      module: 'ai-ticket',
      description: `Excepción streaming: ${error.message}`,
      user: userId,
      method: 'error',
      status: 'error',
      ip: req.clientIp || req.ip || null,
    }).catch((logError) => {
      console.warn('[AI Stream] createLog STREAM_EXCEPTION failed:', logError.message);
    });

    if (!closed) {
      emitSse('error', {
        success: false,
        error: isTimeout ? 'Tiempo máximo de análisis excedido' : 'Error procesando la pregunta en streaming',
        code: isTimeout ? 'STREAM_TIMEOUT' : 'STREAM_ERROR',
        details: error.message,
      });
      emitSse('timeline', {
        totalMs: Date.now() - streamStartedAt,
        success: false,
      });
      emitSse('done', { success: false });
    }
  } finally {
    console.log('[AI Stream] END', { elapsedMs: Date.now() - streamStartedAt, closed });
    clearInterval(heartbeat);
    clearInterval(slowWatchdog);
    clearInterval(stageWatchdog);
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.end();
      } catch (_) {
      }
    }
  }
}

export default {
  askAgent,
  askAgentStream,
};
