// ticketApp.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';

// Conexión a BD
import { connection } from './connection/connection.js';

// Seeds
import { seedDefaultLists } from "./seed/seedLists.js";
import { userDefault } from './seed/seedUser.js';

// Rutas
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import listRoutes from './modules/list/list.routes.js';
import assetsRoutes from './modules/assets/asset.routes.js';
import microsoftRoutes from './modules/microsoft-auth/microsoft.routes.js';
import ticketRoutes from './modules/tickets/ticket.routes.js';
import areasRoutes from './modules/areas/area.routes.js';
import mailRoutes from './modules/mail-processor/mail.routes.js';

import { processUnreadEmails } from './modules/mail-processor/mail.listener.js';

// Servicio de correos


dotenv.config();

// ==============================
// 🔹 CONEXIÓN A BD
// ==============================
connection();

// ==============================
// 🔹 APP EXPRESS
// ==============================
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==============================
// 🔹 CORS CONFIG
// ==============================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));

// ==============================
// 🔹 LOG DE IPs
// ==============================
app.use((req, res, next) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress ||
    'IP desconocida';

  console.log(`[${new Date().toISOString()}] IP: ${ip} - ${req.method} ${req.originalUrl}`);

  req.clientIp = ip;
  next();
});

// ==============================
// 🔹 STATIC FILES
// ==============================
app.use('/uploads', express.static(path.join('uploads')));

// ==============================
// 🔹 Rutas
// ==============================
app.use('/api/auth', authRoutes);
app.use('/api/microsoft', microsoftRoutes);
app.use('/api/users', userRoutes);
app.use('/api/option', listRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/area', areasRoutes);
app.use('/api/getemail', mailRoutes);

// ==============================
// 🔹 Seeds iniciales
// ==============================
(async () => {
  await seedDefaultLists();
  await userDefault();
})();

// ==============================
// 🔹 CRON (procesador de correos)
// ==============================
cron.schedule('* * * * *', async () => {
  try {
    console.log('⏳ Buscando correos entrantes...');
    await processUnreadEmails();
    console.log('✔️ Correos procesados');
  } catch (error) {
    console.error("❌ Error procesando correos:", error);
  }
}, {
  timezone: 'America/Santiago'
});

console.log('⏰ Scheduler de correo activo (cada 1 minuto).');

// ==============================
// 🔹 Iniciar servidor
// ==============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
