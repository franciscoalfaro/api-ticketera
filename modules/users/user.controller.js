import { createLog } from "../logs/logs.service.js";
import { activateUserService, createUserService, deleteUserService, getAllUsersService, getAssignableUsersService, getUserById, updateUserService } from "./user.service.js";

// Obtener todos los usuarios o listar los usuarios
export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const data = await getAllUsersService(page);
    await createLog({
      user: req.user?.id,
      action: "LISTAR_USUARIOS",
      module: "users",
      description: `Listado de usuarios página ${page}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", ...data });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_USUARIOS",
      module: "users",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getAssignableUsers = async (req, res) => {
  try {
    const users = await getAssignableUsersService();
    await createLog({
      user: req.user?.id,
      action: "LISTAR_USUARIOS_ASIGNABLES",
      module: "users",
      description: "Consulta de usuarios asignables",
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", users });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_LISTAR_USUARIOS_ASIGNABLES",
      module: "users",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Obtener un usuario por ID
export const getUser = async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_OBTENER_USUARIO",
        module: "users",
        description: `Usuario no encontrado ${req.params.id}`,
        status: "error",
        method: "GET",
        ip: req.clientIp,
      });
      return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
    }
    await createLog({
      user: req.user?.id,
      action: "OBTENER_USUARIO",
      module: "users",
      description: `Consulta de usuario ${req.params.id}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", user });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_USUARIO",
      module: "users",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: "Error obteniendo usuario" });
  }
};


// Obtener un usuario por token
export const getUserProfile = async (req, res) => {
  const idProfile = req.user.id
  console.log("Solicitud de perfil de usuario recibida.",req.user);
  console.log("ID del perfil solicitado:", idProfile);

  try {
    const user = await getUserById(idProfile);
    if (!user) {
      await createLog({
        user: req.user?.id,
        action: "ERROR_OBTENER_PERFIL_USUARIO",
        module: "users",
        description: `Perfil no encontrado ${idProfile}`,
        status: "error",
        method: "GET",
        ip: req.clientIp,
      });
      return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
    }
    await createLog({
      user: req.user?.id,
      action: "OBTENER_PERFIL_USUARIO",
      module: "users",
      description: `Perfil consultado ${idProfile}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.json({ status: "success", user });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_OBTENER_PERFIL_USUARIO",
      module: "users",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: "Error obteniendo usuario" });
  }
};


// Crear o registrar usuarios por el agente o administrador
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role,area } = req.body;
    const user = await createUserService({ name, email, password, role, area });
    await createLog({
      user: req.user?.id,
      action: "CREAR_USUARIO",
      module: "users",
      description: `nuevo usuario: ${user.name}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(201).json({
      status: "success",
      user,
      message: "Usuario creado correctamente"
    });
  } catch (error) {

    if (error.code === "USER_EXISTS") {
      return res.status(409).json({
        status: "error",
        message: "El usuario ya existe"
      });
    }
    await createLog({
      user: req.user?.id,
      action: "ERROR_CREAR_USUARIO",
      module: "users",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });

    res.status(500).json({
      status: "error",
      message: "Error interno al crear usuario"
    });
  }
};

// Actualizar usuario
export const updateUser = async (req, res) => {
  try {
    const updatedUser = await updateUserService(req.body.id, req.body);

    await createLog({
      user: req.user?.id,
      action: "ACTUALIZAR_USUARIO",
      module: "users",
      description: `Usuario actualizado ${req.body.id}`,
      status: "success",
      method: "PUT",
      ip: req.clientIp,
    });

    res.json({ status: "success", user: updatedUser });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_ACTUALIZAR_USUARIO",
      module: "users",
      description: error.message,
      status: "error",
      method: "PUT",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Actualizar usuario
export const activateUser = async (req, res) => {
  try {
    const updatedUser = await activateUserService(req.params.id);
    await createLog({
      user: req.user?.id,
      action: "ACTIVAR_USUARIO",
      module: "users",
      description: `Usuario activado ${req.params.id}`,
      status: "success",
      method: "PATCH",
      ip: req.clientIp,
    });
    res.json({ status: "success", user: updatedUser });
  } catch (error) {
    console.error(error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_ACTIVAR_USUARIO",
      module: "users",
      description: error.message,
      status: "error",
      method: "PATCH",
      ip: req.clientIp,
    });
    res.status(400).json({ status: "error", message: error.message });
  }
};

// el admin al eliminar debera de cambiar automaticamente el equipamiento del usuario en transito o similar

// Eliminar usuario - al eliminar el usuario solo el admin podra eliminar - 

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar rol del usuario autenticado
    if (!req.user || req.user.role !== "admin") {
      await createLog({
        user: req.user?.id,
        action: "ERROR_ELIMINAR_USUARIO",
        module: "users",
        description: "Intento sin permisos para eliminar usuario",
        status: "warning",
        method: "DELETE",
        ip: req.clientIp,
      });
      return res.status(403).json({
        status: "error",
        message: "No tienes permisos para eliminar usuarios"
      });
    }

    const result = await deleteUserService(id);
    await createLog({
      user: req.user?.id,
      action: "ELIMINAR_USUARIO",
      module: "users",
      description: `Usuario eliminado ${id}`,
      status: "success",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.json(result);

  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    await createLog({
      user: req.user?.id,
      action: "ERROR_ELIMINAR_USUARIO",
      module: "users",
      description: error.message,
      status: "error",
      method: "DELETE",
      ip: req.clientIp,
    });
    res.status(500).json({
      status: "error",
      message: error.message || "Error interno del servidor"
    });
  }
};


