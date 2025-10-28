import {addItemToListService, createListService, deleteItemFromListService, getAllListsService } from "./list.services.js";

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
    const { listId } = req.params;
    const list = await addItemToListService(listId, req.body);
    res.status(200).json({ status: "success", list });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
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
