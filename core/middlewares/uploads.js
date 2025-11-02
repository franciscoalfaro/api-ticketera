import multer from "multer";
import fs from "fs";
import path from "path";

// Función para crear un middleware de subida
export const createUploadMiddleware = ({ folder, prefix, allowedTypes }) => {
  const uploadPath = path.join(process.cwd(), "uploads", folder);

  // Crear carpeta si no existe
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  // Configuración de Multer
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName =
        prefix + Date.now() + path.extname(file.originalname);
      cb(null, uniqueName);
    },
  });

  // Filtro de archivos
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${ext}`), false);
    }
  };

  return multer({ storage, fileFilter });
};
