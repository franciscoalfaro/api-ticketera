import {addItemToListService, createListService, deleteItemFromListService, getAllListsService, updateItemDeletedStatusService } from "./list.services.js";

// Obtener todas las listas
export const getAllListsController = async (req, res) => {
  try {
    const lists = await getAllListsService();
    res.status(200).json({ status: "success", lists });
  } catch (error) {
    console.error("Error al obtener listas:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Crear una nueva lista
export const createListController = async (req, res) => {
  try {
    const list = await createListService(req.body);
    res.status(201).json({ status: "success", list });
  } catch (error) {
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

    res.status(200).json({
      status: "success",
      message: "Elemento agregado correctamente",
      list,
    });
  } catch (error) {
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
    res.status(200).json({ status: "success", list });
  } catch (error) {
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

    res.status(200).json({
      status: "success",
      message: result.message,
      list: result.list,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};