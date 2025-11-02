import * as AreaService from "./area.service.js";

// Crear área
export const createArea = async (req, res) => {
  try {
    const area = await AreaService.createAreaService(req.body);
    res.status(201).json({ status: "success", area });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Listar áreas
export const getAreas = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await AreaService.getAreasService(page);
    res.json({ status: "success", ...data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Obtener un área (ID en body)
export const getAreaById = async (req, res) => {
  try {
    const { id } = req.body;
    const area = await AreaService.getAreaByIdService(id);
    res.json({ status: "success", area });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};

// Actualizar área (ID en body)
export const updateArea = async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const updated = await AreaService.updateAreaService(id, data);
    res.json({ status: "success", area: updated });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar área (ID en body)
export const deleteArea = async (req, res) => {
  try {
    const { id } = req.body;
    const result = await AreaService.deleteAreaService(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
