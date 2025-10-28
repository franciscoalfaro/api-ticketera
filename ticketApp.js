// app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import listRoutes from './modules/list/list.routes.js'
import assetsRoutes from './modules/assets/asset.routes.js'
import microsoftRoutes from './modules/microsoft-auth/microsoft.routes.js';

import path from 'path';
import cookieParser from 'cookie-parser';
import { connection } from './connection/connection.js';

import { seedDefaultLists } from "./seed/seedLists.js";


dotenv.config();

// efectuar conexion a BD
connection();

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));



const allowedOrigins = ['http://localhost:3000/' ,'http://localhost:3000','http://localhost:3001/'];

const corsOptions = {
  origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true); // Permitir acceso
      } else {
          callback(new Error('Origen no permitido por CORS'));
      }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Asegúrate de permitir OPTIONS
  credentials: true,
};

//configurar cors
app.use(cors(corsOptions));

app.use(cookieParser());


app.use('/uploads', express.static(path.join('uploads')));


// Rutas públicas (Auth)
app.use('/api/auth', authRoutes);
// Rutas públicas Microsoft (Auth)
app.use('/api/microsoft',microsoftRoutes );

// Rutas protegidas (Users)
app.use('/api/users', userRoutes);

// Rutas protegidas (listas)
app.use('/api/option', listRoutes);

// Rutas protegidas (Assets)
app.use('/api/assets', assetsRoutes);

// Iniciar el servidor
const PORT = process.env.PORT;


(async () => {
  await seedDefaultLists();
})();


app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
