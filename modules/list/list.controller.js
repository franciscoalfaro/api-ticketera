import {addItemToListService, createListService, deleteItemFromListService, getAllListsService, updateItemDeletedStatusService } from "./list.services.js";
import { createLog } from "../logs/logs.service.js";

// Obtener todas las listas
export const getAllListsController = async (req, res) => {
  try {
    const lists = await getAllListsService();
    console.log("Listas obtenidas:", lists);
    await createLog({
      user: req.user?.id,
      action: "LISTAR_LISTAS",
      module: "list",
      description: "Consulta de todas las listas",
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(200).json({ status: "success", lists });
  } catch (error) {
    console.error("Error al obtener listas:", error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_LISTAS",
      module: "list",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Crear una nueva lista
export const createListController = async (req, res) => {
  try {
    const list = await createListService(req.body);
    await createLog({
      user: req.user?.id,
      action: "CREAR_LISTA",
      module: "list",
      description: `Lista creada: ${list?.name || list?._id}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(201).json({ status: "success", list });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_CREAR_LISTA",
      module: "list",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Agregar un elemento a una lista
export const addItemController = async (req, res) => {
  try {
    const { listId, label, value, color } = req.body;

    if (!listId || !label || !value) {
      return res.status(400).json({
        status: "error",
        message: "Faltan datos obligatorios (listId, label, value)",
      });
    }

    const list = await addItemToListService(listId, { label, value, color });

    await createLog({
      user: req.user?.id,
      action: "AGREGAR_ITEM_LISTA",
      module: "list",
      description: `Item agregado en lista ${listId}: ${label}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    res.status(200).json({
      status: "success",
      message: "Elemento agregado correctamente",
      list,
    });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_AGREGAR_ITEM_LISTA",
      module: "list",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Eliminar (lógicamente) un elemento de una lista
export const deleteItemController = async (req, res) => {
  try {
    //ira por body 
    const { listId, itemId } = req.body;
    const list = await deleteItemFromListService(listId, itemId);
    await createLog({
      user: req.user?.id,
      action: "ELIMINAR_ITEM_LISTA",
      module: "list",
      description: `Item ${itemId} eliminado de lista ${listId}`,
      status: "success",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.status(200).json({ status: "success", list });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ELIMINAR_ITEM_LISTA",
      module: "list",
      description: error.message,
      status: "error",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

//actualizar estado de elemento de la lista controller
export const updateItemDeletedStatusController = async (req, res) => {
  try {
    const { listId, itemId, isDeleted } = req.body;

    if (!listId || !itemId || typeof isDeleted !== "boolean") {
      return res.status(400).json({
        status: "error",
        message: "Faltan datos obligatorios o formato inválido (listId, itemId, isDeleted)",
      });
    }

    const result = await updateItemDeletedStatusService(listId, itemId, isDeleted);

    await createLog({
      user: req.user?.id,
      action: "ACTUALIZAR_ESTADO_ITEM_LISTA",
      module: "list",
      description: `Item ${itemId} en lista ${listId} -> isDeleted=${isDeleted}`,
      status: "success",
      method: "PATCH",
      ip: req.clientIp,
    });

    res.status(200).json({
      status: "success",
      message: result.message,
      list: result.list,
    });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_ACTUALIZAR_ESTADO_ITEM_LISTA",
      module: "list",
      description: error.message,
      status: "error",
      method: "PATCH",
      ip: req.clientIp,
    });
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};