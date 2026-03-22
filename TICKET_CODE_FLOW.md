# 📊 Flujo de Inicialización del Generador de Códigos

## Árbol de Decisión

```
┌─────────────────────────────────┐
│  Aplicación inicia              │
└──────────────┬──────────────────┘
               │
               ▼
        ┌──────────────────┐
        │ initialize()     │
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ ¿Counter existe? │
        └────┬─────────┬───┘
             │         │
        SÍ ◀─┘         └─▶ NO
        │                  │
        ▼                  ▼
    ┌──────────────┐  ┌──────────────────┐
    │ Counter:1093 │  │ Crear Counter: 0 │
    │ lastValue:1093
    └──────────────┘  └──────────────────┘
        │                  │
        └──────┬───────────┘
               │
               ▼
        ┌──────────────────────┐
        │ initialized = true   │
        └──────────────────────┘
               │
               ▼
        ┌──────────────────────────────┐
        │ Listo para generar códigos   │
        └──────────────────────────────┘
```

## Línea de Tiempo: Servidor Nuevo

```
INICIO (BD Nueva, sin datos)
│
├─ T0: Aplicación inicia
│  └─ initialize()
│     └─ Counter no existe
│        └─ Crear Counter(value=0)
│           Logs: "Generador inicializado en BD nueva. Comenzará desde: TCK-0001"
│
├─ T1: Crear Ticket #1
│  └─ generateTicketCode()
│     └─ Counter.increment: 0 → 1
│        └─ Retorna: TCK-0001 ✅
│
├─ T2: Crear Ticket #2
│  └─ generateTicketCode()
│     └─ Counter.increment: 1 → 2
│        └─ Retorna: TCK-0002 ✅
│
├─ T3: Crear Ticket #3
│  └─ generateTicketCode()
│     └─ Counter.increment: 2 → 3
│        └─ Retorna: TCK-0003 ✅
│
└─ Estado Final:
   ├─ Counter: value = 3
   ├─ Tickets: TCK-0001, TCK-0002, TCK-0003
   └─ Próximo: TCK-0004
```

## Línea de Tiempo: Servidor Existente

```
INICIO (BD con datos históricos)
│
├─ T0: Aplicación inicia
│  └─ initialize()
│     └─ Counter existe: value = 1093
│        Logs: "Generador inicializado con counter existente. Próximo: TCK-1094"
│
├─ T1: Crear Ticket #1
│  └─ generateTicketCode()
│     └─ Counter.increment: 1093 → 1094
│        └─ Retorna: TCK-1094 ✅
│
├─ T2: Crear Ticket #2
│  └─ generateTicketCode()
│     └─ Counter.increment: 1094 → 1095
│        └─ Retorna: TCK-1095 ✅
│
└─ Estado Final:
   ├─ Counter: value = 1095
   ├─ Continuación desde: TCK-1094, TCK-1095
   └─ Próximo: TCK-1096
```

## Línea de Tiempo: Migración (Restore de BD)

```
ESCENARIO: Se restaura backup en nuevo servidor

PASO 1: Restauración
├─ Se restaura MongoDB backup
│  ├─ Counter: value = 1093
│  ├─ Tickets: TCK-0001 hasta TCK-0993
│  └─ Datos: 1000+ tickets históricos
│
PASO 2: Inicia aplicación en nuevo servidor
├─ initialize()
│  ├─ Encuentra Counter: value = 1093
│  ├─ lastValue = 1093
│  └─ Logs: "Generador inicializado con counter existente. Próximo: TCK-1094"
│
PASO 3: Primer ticket en nuevo servidor
├─ generateTicketCode()
│  ├─ Counter.increment: 1093 → 1094
│  ├─ Código: TCK-1094
│  ├─ Verificar duplicados: NO EXISTE ✅
│  └─ Retorna: TCK-1094
│
RESULTADO: ✅ Migración limpia sin duplicados
```

## Estados del Generador

| Estado | Counter | lastValue | Initialized | Descripción |
|--------|---------|-----------|-------------|------------|
| Nuevo (sin init) | No existe | 0 | false | Inicio en servidor nuevo |
| Después init (nuevo) | 0 | 0 | true | Listo para TCK-0001 |
| Después init (existente) | 1093 | 1093 | true | Listo para TCK-1094 |
| Después generar | 1094 | 1094 | true | Próximo será TCK-1095 |
| Con error | 0 (fallback) | 0 | true | Recuperación automática |

## Ejemplos de Logs Esperados

### Servidor Nuevo
```
✅ Generador inicializado en BD nueva. Comenzará desde: TCK-0001
[API] POST /ticket/create → Generado: TCK-0001
[API] POST /ticket/create → Generado: TCK-0002
[API] POST /ticket/create → Generado: TCK-0003
```

### Servidor Existente
```
✅ Generador inicializado con counter existente. Próximo: TCK-1094
[API] POST /ticket/create → Generado: TCK-1094
[API] POST /ticket/create → Generado: TCK-1095
```

### Después de Migración
```
✅ Generador inicializado con counter existente. Próximo: TCK-1094
[API] POST /ticket/create → Generado: TCK-1094
[API] POST /ticket/create → Generado: TCK-1095
[API] POST /ticket/create → Generado: TCK-1096
```

## Garantías

1. **✅ Continuidad:** Siempre continúa desde donde se quedó
2. **✅ Unicidad:** Nunca genera códigos duplicados
3. **✅ Simplicidad:** Incremento simple +1 por ticket
4. **✅ Recuperación:** Manejo automático de errores
5. **✅ Escalabilidad:** Funciona con millones de tickets
6. **✅ Auditoría:** Códigos siempre ordenados secuencialmente
