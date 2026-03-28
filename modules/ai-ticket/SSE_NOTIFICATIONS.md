# Notificaciones SSE para Consultas IA - Propuestas

## Estado actual
El endpoint `/api/ai-ticket/ask-stream` envía:
- `status` → etapas (`received`, `analyzing`)
- `result` → respuesta final completa
- `error` → errores
- `done` → fin de transmisión
- `ping` → heartbeat cada 15s

## Notificaciones propuestas

### 1. **Intent Detection** (nueva etapa)
```json
{
  "event": "intent",
  "data": {
    "detected": "top_closers",
    "confidence": 0.95,
    "timeRange": "this_month",
    "limit": 5,
    "daysBack": null,
    "mappedFrom": "fallback",
    "interpreter_model": "qwen2.5-coder:1.5b"
  }
}
```
**Valor**: Mostrar al usuario "Entendí que quieres saber quién cerró más tickets este mes" antes de procesar.

---

### 2. **Query Execution Progress** (nueva etapa)
```json
{
  "event": "progress",
  "data": {
    "stage": "query_execution",
    "step": "aggregate_by_closedBy",
    "message": "Buscando agentes que cerraron tickets...",
    "estimated_time_ms": 250
  }
}
```
Variantes:
- `stage: "query_execution"` → `step: "grouping" | "sorting" | "lookup_users" | "filtering"`
- `stage: "llm_response"` → `step: "temperature_setup" | "prompt_generation" | "model_inference"`

**Valor**: Mostrar progreso visual ("cargando...") más específico.

---

### 3. **Data Digest Summary** (antes de LLM)
```json
{
  "event": "analytics",
  "data": {
    "type": "top_closers",
    "found": 5,
    "top": {
      "name": "Administrador",
      "email": "admin@ticketera.local",
      "count": 12
    },
    "timeRange": "this_month",
    "totalTickets": 45
  }
}
```
**Valor**: Mostrar números clave del análisis mientras se genera texto LLM.

---

### 4. **Model Selection** (durante LLM)
```json
{
  "event": "model_info",
  "data": {
    "phase": "interpretation",
    "model": "qwen2.5-coder:1.5b",
    "inference_time_ms": 350
  }
}
```
Ó después:
```json
{
  "event": "model_info",
  "data": {
    "phase": "response_generation",
    "model": "minimax-m2:cloud",
    "temperature": 0.3,
    "tokens_predicted": 185,
    "inference_time_ms": 1200
  }
}
```
**Valor**: Debugging + mostrar latencias de modelos.

---

### 5. **Quality Filter Result**
```json
{
  "event": "quality_check",
  "data": {
    "llm_text_length": 245,
    "deterministic_fallback_length": 180,
    "passed_filter": false,
    "reason": "LLM output too short vs deterministic (45% rule)",
    "using_fallback": true
  }
}
```
**Valor**: Transparencia sobre por qué se eligió determinístico vs LLM.

---

### 6. **Warning/Info Messages**
```json
{
  "event": "warning",
  "data": {
    "level": "warn",
    "code": "LOW_DATA_VOLUME",
    "message": "Solo encontré 1 agente con cierres. Considera expandir el rango de fechas.",
    "suggestion": "Prueba con 'últimos 30 días' para más contexto"
  }
}
```

Ó info:
```json
{
  "event": "info",
  "data": {
    "message": "Detecté variante: 'quién resolvió' = 'agente cerró'",
    "synonym_match": true
  }
}
```

---

### 7. **Detailed Result** (antes del `done`)
```json
{
  "event": "details",
  "data": {
    "type": "top_closers",
    "closers": [
      { "name": "Administrador", "email": "admin@ticketera.local", "count": 1 },
      { "name": "noel", "email": null, "count": 0 }
    ],
    "rangeLabel": "este mes",
    "totalTickets": 45,
    "generated_at": "2026-03-24T10:30:00Z"
  }
}
```
**Valor**: Datos estructurados para renderizar tablas/gráficos antes de respuesta LLM.

---

### 8. **Execution Timeline**
```json
{
  "event": "timeline",
  "data": {
    "received_at": "2026-03-24T10:29:50Z",
    "intent_detected_at": "2026-03-24T10:29:51Z",
    "intent_ms": 1,
    "query_executed_at": "2026-03-24T10:29:52Z",
    "query_ms": 250,
    "llm_response_generated_at": "2026-03-24T10:29:54Z",
    "llm_ms": 1200,
    "total_ms": 4000
  }
}
```
**Valor**: Mostrar cuello de botella (qué fase fue lenta).

---

## Propuesta de secuencia SSE

```
1. status: received
2. status: analyzing
3. intent: { detected: "top_closers", ... }
4. progress: { stage: "query_execution" }
5. analytics: { type: "top_closers", found: 5, top: {...} }
6. progress: { stage: "llm_response" }
7. model_info: { phase: "response_generation", model: "minimax-m2:cloud", ... }
8. quality_check: { passed_filter: true, using_fallback: false }
9. details: { type: "top_closers", closers: [...] }
10. result: { success: true, question: "...", agentResponse: "...", analytics: {...}, meta: {...} }
11. timeline: { total_ms: 4000, ... }
12. done: { success: true }
```

## Beneficios por tipo de notificación

| Notificación | Frontend UX | Debugging | Analytics |
|---|---|---|---|
| `intent` | ✅ Confirmación semántica | ✅ Ver si interpretó bien | ✅ Tracking de tipos |
| `progress` | ✅ Barra de progreso | ✅ Punto de fallo | ✅ Latencia de BD |
| `analytics` | ✅ Mostrar datos mientras genera texto | ✅ Ver si números correctos | ✅ Verificar cálculos |
| `model_info` | ✅ Mostrar "Usando modelo X" | ✅ Cuál modelo fue lento | ✅ Costo LLM |
| `quality_check` | ✅ Explicar por qué respuesta | ✅ Validar filtro | ✅ Confianza en resp |
| `warning/info` | ✅ Sugerencias al usuario | ✅ Edge cases | ✅ Patrón común |
| `details` | ✅ Render tabla/gráfico | ✅ Ver estructura | ✅ Riqueza de datos |
| `timeline` | ✅ Mostrar que fue rápido | ✅ Cuello de botella | ✅ SLA tracking |

## Recomendación de MVP

Para comenzar, implementa estas 4 en order de valor/esfuerzo:
1. **`intent`** → Muestra confirmación semántica (5 min)
2. **`analytics`** → Datos numéricos antes que LLM (10 min)
3. **`quality_check`** → Transparencia de fallback (5 min)
4. **`timeline`** → Latencias totales (5 min)

**Total: ~25 minutos para UX significativa.**

Las otras 4 son bonus para debugging/analytics posterior.
