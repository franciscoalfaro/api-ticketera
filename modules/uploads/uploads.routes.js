import { Router } from "express";
import path from "path";
import fs from "fs";
import { auth } from "../../core/middlewares/authMiddleware.js";

const router = Router();
const uploadsRoot = path.resolve(process.cwd(), "uploads");

router.get("/*path", auth, (req, res) => {
  try {
    const pathParam = req.params.path;
    const requestedPath = Array.isArray(pathParam)
      ? pathParam.map((segment) => decodeURIComponent(segment)).join(path.sep)
      : decodeURIComponent(pathParam || "");

    if (!requestedPath) {
      return res.status(400).send("Ruta de archivo inválida");
    }

    const filePath = path.resolve(uploadsRoot, requestedPath);

    if (!filePath.startsWith(`${uploadsRoot}${path.sep}`) && filePath !== uploadsRoot) {
      return res.status(400).send("Ruta de archivo inválida");
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Archivo no encontrado");
    }

    res.sendFile(filePath);
  } catch (error) {
    return res.status(500).send("Error al obtener archivo");
  }
});

export default router;

