import { Router } from "express";
import {
  createArea,
  getAreas,
  getAreaById,
  updateArea,
  deleteArea,
} from "./area.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = Router();

router.use(auth);
router.use(logAction("areas"));

// Crear área
router.post("/create", createArea);

// Listar áreas (paginadas)
router.get("/all/:page", getAreas);

// Obtener área por body
router.post("/get", getAreaById);

// Actualizar área (id en body)
router.put("/update", updateArea);

// Eliminar área lógicamente (id en body)
router.delete("/delete", deleteArea);

export default router;
