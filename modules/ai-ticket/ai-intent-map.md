# Mapa de Intenciones IA Ticketera

Este mapa define las intenciones canónicas que usa el módulo de analítica IA.
La idea es mantener **pocas intenciones estables** y variar por parámetros (`timeRange`, `daysBack`, `limit`, etc.).

## Intenciones canónicas

| queryType | Objetivo | Frases ejemplo |
|---|---|---|
| `last_tickets` | Listar tickets recientes | "últimos 5 tickets", "lista de tickets recientes" |
| `last_ticket_detail` | Detallar último ticket (incluye reportante) | "último ticket y de qué se trató", "quién lo reportó" |
| `trend_summary` | Resumen de tendencia entre periodos | "tendencia esta semana", "cómo evolucionaron" |
| `repeated_causes` | Detectar causas más repetidas | "causas repetidas últimos 7 días", "problemas repetidos" |
| `daily_peaks` | Hallar días pico | "qué días hubo más tickets", "días con mayor cantidad" |
| `top_reporters` | Ranking de usuarios que más reportan | "qué usuarios reportaron más tickets", "quién generó más tickets" |
| `most_repeated` | Categoría/tipo más frecuente | "categoría más reportada", "tipo más común" |
| `priority_stats` | Prioridades dominantes | "prioridad más común", "tickets por prioridad" |
| `status_distribution` | Distribución por estado | "distribución por estado", "estados de tickets" |
| `category_stats` | Filtro por categoría concreta | "tickets de categoría X" |

## Parámetros (slots)

- `timeRange`: `all`, `today`, `this_week`, `this_month`, `last_7_days`, `last_30_days`, `last_n_days`
- `daysBack`: número de días cuando aplica `last_n_days`
- `limit`: cantidad máxima de resultados
- `category`: categoría objetivo (en `category_stats`)

## Estrategia recomendada para crecer

1. **No crear una intención por frase**.
2. Agregar sinónimos/patrones al mapa de la intención existente.
3. Crear nueva intención solo si requiere **consulta/aggregate distinta** en base de datos.
4. Mantener validadores de calidad para evitar respuestas LLM genéricas.
