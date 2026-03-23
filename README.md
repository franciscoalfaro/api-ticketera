# API Ticketera

Backend de gestión de tickets de soporte, autenticación, activos, reportes y procesamiento de correos.

## Producción (AWS)

- Base URL pública: `https://api.franciscoalfaro.cl/api-ticketera/api`

## Stack y versiones

- Node.js: proyecto ESM (`"type": "module"`)
- Express: `^5.1.0`
- MongoDB + Mongoose: `mongoose ^8.19.0`
- Autenticación JWT: `jwt-simple ^0.5.6`
- Hash de contraseñas: `bcrypt ^6.0.0`
- CORS: `cors ^2.8.5`
- Cookies: `cookie-parser ^1.4.7`
- Jobs programados: `node-cron ^4.2.1`
- Correo Microsoft Graph: `@microsoft/microsoft-graph-client ^3.0.7`, `@azure/identity ^4.13.0`, `@azure/msal-node ^3.8.0`
- Envío de correos: `nodemailer ^7.0.6`
- PDF reportes: `pdfkit ^0.17.2`
- Subida de archivos: `multer ^2.0.2`
- Utilidades: `moment ^2.30.1`, `validator ^13.15.15`
- Dev: `nodemon ^3.1.10`

## Scripts

```bash
pnpm install
pnpm dev
pnpm start
```

> También puedes usar `npm` si prefieres, pero el proyecto incluye `pnpm-lock.yaml`.

## Arquitectura rápida

- Entrada: `ticketApp.js`
- Conexión Mongo: `connection/connection.js`
- Módulos por dominio: `modules/*`
- Middlewares: `core/middlewares/*`
- Seeds iniciales: `seed/seedLists.js`, `seed/seedUser.js`
- Cron de correos: cada 1 minuto (`processUnreadEmails`)

## Autenticación

- Middleware: `auth` en `core/middlewares/authMiddleware.js`
- Usa cookies HTTP Only:
  - `access_token`
  - `refresh_token`
- Rutas públicas principales:
  - `POST /auth/login`
  - `POST /auth/register`
  - `GET /microsoft/login`
  - `GET /microsoft/callback`
  - `GET /enterprise/public`

## Endpoints funcionales

Todos los paths están relativos a:

- `https://api.franciscoalfaro.cl/api-ticketera/api`

### Auth (`/auth`)

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/logout` (requiere auth)

### Microsoft Auth (`/microsoft`)

- `GET /microsoft/login`
- `GET /microsoft/callback`

### Usuarios (`/users`) _(requiere auth)_

- `GET /users/listusers/:page`
- `GET /users/available`
- `GET /users/getuser/:id`
- `GET /users/getprofile`
- `POST /users/create`
- `PUT /users/update`
- `PUT /users/reactivate/:id`
- `DELETE /users/delete/:id`

### Listas/Options (`/option`) _(requiere auth)_

- `GET /option/listall`
- `POST /option/create`
- `POST /option/add`
- `DELETE /option/delete`
- `PUT /option/reactivate`

### Tickets (`/ticket`) _(requiere auth)_

- `POST /ticket/create` (multipart, campo `attachments`)
- `GET /ticket/all/:page`
- `GET /ticket/mytickets/:page`
- `PUT /ticket/update`
- `POST /ticket/comment/updates` (multipart, campo `attachments`)
- `DELETE /ticket/delete`
- `GET /ticket/getticket/:id`
- `GET /ticket/:id/updates/summary`
- `GET /ticket/update/:updateId`

### Áreas (`/area`) _(requiere auth)_

- `POST /area/create`
- `GET /area/all/:page`
- `POST /area/get`
- `PUT /area/update`
- `DELETE /area/delete`

### Assets (`/assets`) _(requiere auth)_

- `GET /assets/allasset/:page`
- `GET /assets/get/:id`
- `POST /assets/create`
- `PUT /assets/update/:id`
- `DELETE /assets/delete/:id`

### Enterprise (`/enterprise`)

- `GET /enterprise/public` (pública)
- `POST /enterprise/create` (auth)
- `GET /enterprise/get/:id` (auth)
- `PUT /enterprise/update/:id` (auth)
- `DELETE /enterprise/delete/:id` (auth)
- `POST /enterprise/uploadlogo/:id` (auth, multipart campo `file0`)

### Mail Processor (`/getemail`)

- `GET /getemail/fetch`

### Reports (`/reports`) _(requiere auth)_

- `POST /reports/dashboard/agents/operational`
- `GET /reports/dashboard/agents/operational`
- `GET /reports/dashboard/agents/operational/export/pdf`
- `GET /reports/dashboard/agents/operational/export/excel`

### Logs (`/logs`) _(requiere auth)_

- `GET /logs/`
- `POST /logs/filter`

### Uploads (`/uploads`) _(requiere auth)_

- `GET /uploads/*path` (sirve archivos protegidos)

## Variables de entorno

Configurar al menos:

```bash
PORT=5000
MONGODB_URI=mongodb+srv://...

# Auth/JWT
SECRET_KEY=...
REFRESH_SECRET_KEY=...

# Microsoft / Graph
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
MICROSOFT_REDIRECT_URI=https://api.franciscoalfaro.cl/api-ticketera/api/microsoft/callback
SUPPORT_MAILBOX=soporte@tu-dominio.cl

# URLs
FRONTEND_URL=https://tu-frontend
BACK_URL=https://api.franciscoalfaro.cl/api-ticketera

# Assets
COMPANY_PREFIX=DM
```

> Las llaves JWT usadas actualmente son `SECRET_KEY` y `REFRESH_SECRET_KEY`.

## Funcionalidades principales

- Gestión completa de tickets (crear, actualizar, comentarios, adjuntos)
- Autenticación local + Microsoft OAuth
- Gestión de usuarios, roles, áreas, activos y empresa
- Reporte operativo de agentes con exportación PDF y Excel
- Processor de correo entrante (Microsoft Graph) cada minuto
- Respuesta por correo y trazabilidad en logs
- Carga de archivos con rutas protegidas por autenticación

## CORS y dominios permitidos

Configurados en `ticketApp.js`:

- `https://api.franciscoalfaro.cl`
- `https://ticketplatform.pages.dev`


## Deploy en AWS (referencia)

Para despliegue en EC2/VM con Nginx reverse proxy:

1. Levantar app Node en `PORT` interno (ej. `5000`)
2. Exponer por Nginx bajo prefijo `/api-ticketera`
3. Proxy esperado a app:
   - público: `/api-ticketera/api/...`
   - interno: `/api/...`

## Notas operativas

- Al iniciar la app, ejecuta seeds iniciales de listas y usuario base.
- Cron de correo activo cada 1 minuto (zona `America/Santiago`).
- Logs de IP y request se registran en consola y módulo de logs.

## Licencia

MIT
