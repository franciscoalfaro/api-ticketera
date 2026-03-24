import { askAnalytics } from './ai-ticket.analytics.service.js';
import { createLog } from '../logs/logs.service.js';

const sendSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

  req.on('close', () => {
    closed = true;
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
      sendSseEvent(res, 'ping', { ts: new Date().toISOString() });
    }
  }, 15000);

  try {
    sendSseEvent(res, 'status', {
      stage: 'received',
      message: 'Pregunta recibida, iniciando análisis.',
    });

    await createLog({
      action: 'AI_AGENT_QUESTION_STREAM',
      description: `Pregunta streaming al agente IA: "${question}"`,
      user: userId,
      timestamp: new Date(),
    });

    if (closed) return;

    sendSseEvent(res, 'status', {
      stage: 'analyzing',
      message: 'Analizando la consulta y preparando respuesta.',
    });

    const result = await askAnalytics(question);

    if (closed) return;

    if (!result.success) {
      await createLog({
        action: 'AI_AGENT_STREAM_ERROR',
        description: `Error en consulta streaming: ${result.error}`,
        user: userId,
      });

      sendSseEvent(res, 'error', {
        success: false,
        error: result.error,
        details: result.details || null,
      });
      sendSseEvent(res, 'done', { success: false });
      return;
    }

    await createLog({
      action: 'AI_AGENT_STREAM_SUCCESS',
      description: `Análisis streaming completado. Tipo: ${result.analytics?.type}`,
      user: userId,
    });

    sendSseEvent(res, 'result', result);
    sendSseEvent(res, 'done', { success: true });
  } catch (error) {
    console.error('[AI Agent Stream] Error:', error);

    await createLog({
      action: 'AI_AGENT_STREAM_EXCEPTION',
      description: `Excepción streaming: ${error.message}`,
      user: userId,
    });

    if (!closed) {
      sendSseEvent(res, 'error', {
        success: false,
        error: 'Error procesando la pregunta en streaming',
        details: error.message,
      });
      sendSseEvent(res, 'done', { success: false });
    }
  } finally {
    clearInterval(heartbeat);
    if (!closed) {
      res.end();
    }
  }
}

export default {
  askAgent,
  askAgentStream,
};
