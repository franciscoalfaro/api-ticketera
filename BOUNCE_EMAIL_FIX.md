# Solución: Detección y Filtrado de Rebotes de Correo

## Problema Original

Cuando se creaba un ticket manual con un email inválido o que rebotaba:

1. Se generaba el ticket con código `TCK-993`
2. Se enviaba un correo de confirmación
3. **El correo rebotaba** (destinatario no existe)
4. **El rebote llegaba como un nuevo correo** sin header `X-Ticket-ID`
5. **El sistema intentaba crear un NUEVO ticket** con los mismos datos
6. **Se asignaba el mismo código** → Error `E11000: duplicate key error`

```
❌ Error procesando correo: MongoServerError: E11000 duplicate key error 
collection: ticketera.tickets index: code_1 dup key: { code: "TCK--993" }
```

## Solución Implementada

Se agregó una **función de detección de rebotes** (`isBounceEmail`) que identifica:

### 1. Headers de Rebotes (NDR - Non-Delivery Reports)
- `X-Failed-Recipients`
- `X-Mailer` con "Mail Delivery System"
- `X-Autoreply` / `X-Autoreply-From`
- `Precedence: bulk` / `Precedence: auto_reply`

### 2. Remitentes Típicos de Rebotes
- `mailer-daemon@...`
- `postmaster@...`
- `noreply@...` / `no-reply@...`
- `donotreply@...` / `do-not-reply@...`
- Cualquier email del sistema de correos

### 3. Asuntos que Indican Rebote
- "Undeliverable:"
- "Delivery Status Notification"
- "Mail Delivery Failed"
- "Returned mail:"
- "Failure Notice"
- etc.

### 4. Contenido del Cuerpo
- "delivery failed"
- "undeliverable"
- "could not be delivered"
- "failed to deliver"
- "did not reach the following recipient"
- etc.

## Cambios en el Código

### `modules/mail-processor/mail.service.js`

#### Función Nueva: `isBounceEmail(headers, from, subject, html)`
```javascript
const isBounceEmail = (headers, from, subject, html) => {
  // Detecta si es un rebote de correo analizando:
  // - Headers del email
  // - Remitente
  // - Asunto
  // - Contenido del cuerpo
  return hasBouncheHeader || hasFromBounce || hasSubjectBounce || hasBodyBounce;
};
```

#### Cambios en `processIncomingMail()`
```javascript
// ANTES: Solo detectaba correos del sistema
// AHORA: También detecta rebotes

// 🔥 FILTRAR REBOTES DE CORREO (NUEVO)
if (isBounceEmail(headers, from, originalSubject, rawHtml)) {
  console.log(`⚠️ Rebote de correo ignorado...`);
  await markAsRead(mail.id); // Marcar como leído para no procesar de nuevo
  return {
    success: false,
    message: "Rebote de correo ignorado",
    action: "bounce_ignored",
    from
  };
}

// 🔥 FILTRAR CORREOS DEL SISTEMA (EXISTENTE)
if (isSystemEmail(headers, from, originalSubject, rawHtml)) {
  // ... resto del código
}
```

#### Cambios en `processIncomingEmails()`
```javascript
// ANTES: Contaba createdCount, updatedCount, ignoredCount
// AHORA: También cuenta bounceCount

const results = [];
let createdCount = 0;
let updatedCount = 0;
let ignoredCount = 0;
let bounceCount = 0; // NUEVO

// En el loop:
if (result.action === "bounce_ignored") {
  bounceCount++;
}

// En el resultado:
console.log(`📊 Resultados: ${createdCount} creados, ${updatedCount} actualizados, ${ignoredCount} ignorados, ${bounceCount} rebotes`);
```

## Flujo de Procesamiento Mejorado

```
📧 Correo llega
   ↓
├─ ¿Es rebote? → ⚠️ Ignorar + marcar como leído → ✔️ bounce_ignored
│
├─ ¿Es correo del sistema? → 🚫 Ignorar + marcar como leído → ✔️ null
│
├─ ¿Es de dominio no permitido? → ⚠️ Ignorar → ✔️ null
│
├─ ¿Tiene X-Ticket-ID o TCK-xxxx en asunto?
│  └─ Sí → Buscar ticket existente
│     ├─ ¿Existe? → Verificar si es update duplicado
│     │  └─ No duplicado → Agregar update → ✔️ updated
│     │  └─ Duplicado → Ignorar → ✔️ ignored
│     └─ No existe → Crear nuevo ticket → ✔️ created
│
└─ No tiene ID → Crear nuevo ticket → ✔️ created
```

## Beneficios

✅ **No más errores E11000** - Los rebotes se filtran antes de intentar crear tickets  
✅ **Menos tickets duplicados** - Se evita la cascada de rebotes creando múltiples tickets  
✅ **Mejor auditoría** - Los rebotes se registran en logs como "bounce_ignored"  
✅ **Mantenimiento limpio** - Los rebotes se marcan como leídos automáticamente  

## Testing

Para probar la solución:

1. **Crear un ticket manual** con un email que no existe o rebotará
2. **Revisar los logs** del scheduler de correos
3. **Verificar que:**
   - ❌ NO se crean múltiples tickets con el mismo código
   - ✅ Los rebotes aparecen como "⚠️ Rebote de correo ignorado"
   - ✅ Se muestran en las estadísticas: "4 rebotes"

## Ejemplo de Logs Esperados

```
⏳ Buscando correos entrantes...
📨 Encontrados 3 correos nuevos

📧 Procesando: Undeliverable: Mail delivery failed...
⚠️ Rebote de correo ignorado: Mail delivery failed... desde mailer-daemon@...

📧 Procesando: Delivery Status Notification...
⚠️ Rebote de correo ignorado: Delivery Status Notification... desde postmaster@...

📧 Procesando: Nueva solicitud de cliente
✉️ Ticket TCK-994 actualizado desde email

✔️ Correos procesados
📊 Resultados: 0 creados, 1 actualizado, 0 ignorados, 2 rebotes
```

## Notas Importantes

- Los rebotes se marcan automáticamente como leídos para evitar reprocesamiento
- Los patrones de detección se pueden expandir según necesidad
- Si necesitas ajustar patrones, modifica `bounceHeaderPatterns`, `bounceFromPatterns`, `bounceSubjectPatterns` o `bounceBodyPatterns` en `isBounceEmail()`
