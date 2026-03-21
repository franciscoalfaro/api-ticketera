import { createLog } from "../logs/logs.service.js";
import { createAssetService, deleteAssetService, getAllAssetsService, getAssetByIdService, updateAssetService } from './asset.service.js'

// Crear un activo
export const createAsset = async (req, res) => {

  try {
    const asset = await createAssetService(req.body, req.user.id);

    res.status(201).json({ status: "success", asset });
    await createLog({
      user: req.user.id,
      action: "CREAR_ACTIVO",
      module: "assets",
      description: `Nuevo equipo: ${asset.name}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_CREAR_ACTIVO",
      module: "assets",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Obtener todos
export const getAllAssets = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;     // Página desde params
    const limit = 1;                                 // Tamaño fijo de página (puedes ajustarlo)
    const status = req.query.status || null;         // Opcional, ?status=activo
    const search = req.query.search || "";           // Opcional, ?search=laptop

    const data = await getAllAssetsService(page, limit, status, search);

    await createLog({
      user: req.user?.id,
      action: "LISTAR_ACTIVOS",
      module: "assets",
      description: `Listado de activos página ${page}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });

    res.status(200).json({
      status: "success",
      ...data
    });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_ACTIVOS",
      module: "assets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({
      status: "error",
      message: "Error al obtener los activos"
    });
  }
};

// Obtener por ID
export const getAssetById = async (req, res) => {
  try {
    const asset = await getAssetByIdService(req.params.id);
    await createLog({
      user: req.user?.id,
      action: "OBTENER_ACTIVO",
      module: "assets",
      description: `Consulta de activo ${req.params.id}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", asset });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_ACTIVO",
      module: "assets",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(404).json({ status: "error", message: error.message });
  }
};

// Actualizar
export const updateAsset = async (req, res) => {
  try {
    const asset = await updateAssetService(req.params.id, req.body);
    await createLog({
      user: req.user?.id,
      action: "ACTUALIZAR_ACTIVO",
      module: "assets",
      description: `Equipo actualizado: ${asset.name}`,
      status: "success",
      method: "PUT",
      ip: req.clientIp,
    });
    res.json({ status: "success", asset });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ACTUALIZAR_ACTIVO",
      module: "assets",
      description: error.message,
      status: "error",
      method: "PUT",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar
export const deleteAsset = async (req, res) => {
  try {
    const result = await deleteAssetService(req.params.id);
    await createLog({
      user: req.user?.id,
      action: "ELIMINAR_ACTIVO",
      module: "assets",
      description: `Activo ID ${req.params.id} eliminado`,
      status: "success",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.json({ status: "success", result });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ELIMINAR_ACTIVO",
      module: "assets",
      description: error.message,
      status: "error",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};
