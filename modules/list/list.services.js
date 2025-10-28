import List from "./list.model.js";

// Crear lista
export const createListService = async ({ name, type, description, items }) => {
  const existing = await List.findOne({ name, type, isDeleted: false });
  if (existing) throw new Error("Ya existe una lista con este nombre y tipo");
  return await List.create({ name, type, description, items });
};

// Obtener todas las listas activas
export const getAllListsService = async () => {
  return await List.find({ isDeleted: false });
};

// Agregar un nuevo elemento a una lista
export const addItemToListService = async (listId, { label, value, color }) => {
  const list = await List.findById(listId);
  if (!list) throw new Error("Lista no encontrada");

  const exists = list.items.find(i => i.value === value.toLowerCase());
  if (exists) throw new Error("El elemento ya existe en esta lista");

  list.items.push({ label, value: value.toLowerCase(), color });
  await list.save();
  return list;
};

// Eliminación lógica de un elemento dentro de una lista
export const deleteItemFromListService = async (listId, itemId) => {
  const list = await List.findById(listId);
  if (!list) throw new Error("Lista no encontrada");

  const item = list.items.id(itemId);
  if (!item) throw new Error("Elemento no encontrado");

  item.isDeleted = true;
  item.deletedAt = new Date();
  await list.save();
  return list;
};
