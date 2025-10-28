import { createLog } from "../../core/services/log.service.js";
import {  createAssetService, deleteAssetService, getAllAssetsService, getAssetByIdService, updateAssetService } from './asset.service.js'

// Crear un activo
export const createAsset = async (req, res) => {

  try {
    const asset = await createAssetService(req.body, req.user.id);

    await createLog({
      user: req.user.id,
      action: "CREAR_ACTIVO",
      module: "assets",
      description: `Nuevo equipo: ${asset.name}`,
      status: "success",
      method: "POST",
    });
    res.status(201).json({ status: "success", asset });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user.id,
      action: "ERROR_CREAR_ACTIVO",
      module: "assets",
      description: error.message,
      status: "error",
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

    res.status(200).json({
      status: "success",
      ...data
    });
  } catch (error) {
    console.error(error);
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
    res.json({ status: "success", asset });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};

// Actualizar
export const updateAsset = async (req, res) => {
  try {
    const asset = await updateAssetService(req.params.id, req.body);
    console.log('equipaamiento',asset)
    await createLog({
      user: req.user?.id,
      action: "ACTUALIZAR_ACTIVO",
      module: "assets",
      description: `Equipo actualizado: ${asset.name}`,
      status: "success",
      method: "PUT",
    });
    res.json({ status: "success", asset });
  } catch (error) {
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
    });
    res.json({ status: "success", result });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};
