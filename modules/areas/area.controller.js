import * as AreaService from "./area.service.js";
import { createLog } from "../logs/logs.service.js";

// Crear área
export const createArea = async (req, res) => {
  try {
    const area = await AreaService.createAreaService(req.body);
    await createLog({
      user: req.user?.id,
      action: "CREAR_AREA",
      module: "areas",
      description: `Área creada: ${area?.name || area?._id}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(201).json({ status: "success", area });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_CREAR_AREA",
      module: "areas",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Listar áreas
export const getAreas = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await AreaService.getAreasService(page);
    await createLog({
      user: req.user?.id,
      action: "LISTAR_AREAS",
      module: "areas",
      description: `Listado de áreas página ${page}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", ...data });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_AREAS",
      module: "areas",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Obtener un área (ID en body)
export const getAreaById = async (req, res) => {
  try {
    const { id } = req.body;
    const area = await AreaService.getAreaByIdService(id);
    await createLog({
      user: req.user?.id,
      action: "OBTENER_AREA",
      module: "areas",
      description: `Consulta de área ${id}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", area });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_AREA",
      module: "areas",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(404).json({ status: "error", message: error.message });
  }
};

// Actualizar área (ID en body)
export const updateArea = async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const updated = await AreaService.updateAreaService(id, data);
    await createLog({
      user: req.user?.id,
      action: "ACTUALIZAR_AREA",
      module: "areas",
      description: `Área actualizada ${id}`,
      status: "success",
      method: "PUT",
      ip: req.clientIp,
    });
    res.json({ status: "success", area: updated });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ACTUALIZAR_AREA",
      module: "areas",
      description: error.message,
      status: "error",
      method: "PUT",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar área (ID en body)
export const deleteArea = async (req, res) => {
  try {
    const { id } = req.body;
    const result = await AreaService.deleteAreaService(id);
    await createLog({
      user: req.user?.id,
      action: "ELIMINAR_AREA",
      module: "areas",
      description: `Área eliminada ${id}`,
      status: "success",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.json(result);
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ELIMINAR_AREA",
      module: "areas",
      description: error.message,
      status: "error",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};
