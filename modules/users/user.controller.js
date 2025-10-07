import * as UserService from "./user.service.js";

// Obtener todos los usuarios o listar los usuarios
export const getUsers = async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    res.json({ status: "success", users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Error obteniendo usuarios" });
  }
};

// Obtener un usuario por ID
export const getUser = async (req, res) => {
  try {
    const user = await UserService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
    res.json({ status: "success", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Error obteniendo usuario" });
  }
};


// Obtener un usuario por token
export const getUserProfile = async (req, res) => {
  const idProfile = req.user.id
  try {
    const user = await UserService.getUserById(idProfile);
    if (!user) return res.status(404).json({ status: "error", message: "Usuario no encontrado" });
    res.json({ status: "success", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Error obteniendo usuario" });
  }
};


// Crear o registrar usuarios por el agente o administrador
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const user = await UserService.createUserService({ name, email, password, role });
    res.status(201).json({
      status: "success",
      user,
      message: "Usuario creado correctamente"
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);

    if (error.code === "USER_EXISTS") {
      return res.status(409).json({
        status: "error",
        message: "El usuario ya existe"
      });
    }

    res.status(500).json({
      status: "error",
      message: "Error interno al crear usuario"
    });
  }
};

// Actualizar usuario
export const updateUser = async (req, res) => {
  try {
    const updatedUser = await UserService.updateUser(req.params.id, req.body);
    res.json({ status: "success", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Eliminar usuario
export const deleteUser = async (req, res) => {
  try {
    await UserService.deleteUser(req.params.id);
    res.json({ status: "success", message: "Usuario eliminado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
