// app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connection } from './bd/conexion.js';
import path from 'path';
import cookieParser from 'cookie-parser';

dotenv.config();

// efectuar conexion a BD
connection();

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));



const allowedOrigins = ['*'];

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

// Rutas



// Iniciar el servidor
const PORT = process.env.PORT;


app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
