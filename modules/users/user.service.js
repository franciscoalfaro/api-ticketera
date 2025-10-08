import User from "./user.model.js";
import bcrypt from "bcrypt";
//microsoft auth
export const findByEmail = async (email) => {
  return await User.findOne({ email });
};

export const create = async (data) => {
  const user = new User(data);
  return await user.save();
};
//-------------------------


// Obtener todos los usuarios
export const getAllUsers = async () => {
  return await User.find();
};

// Obtener usuario por ID
export const getUserById = async (id) => {
  return await User.findById(id);
};

// Crear un usuario manual (opcional, además de auth.register, se debe de incrementar el id, validando previamente que microsoftId no este en uso  )
export const createUserService = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    const error = new Error("El usuario ya existe");
    error.code = "USER_EXISTS";
    throw error;
  }

  const hashed = password ? await bcrypt.hash(password, 10) : undefined;
  const user = await User.create({ name, email, password: hashed, role, microsoftId: `local-${Date.now()}`});
  return user;
};

// Actualizar usuario
export const updateUserService = async (id, updateData) => {
  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};

//activar el usuario 
export const activateUserService = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new Error("Usuario no encontrado");

  user.isDeleted = false;
  user.deletedAt = new Date();
  await user.save();

  return { status: "success", message: "Usuario activado nuevamente" };
};

// Eliminar usuario (lógicamente), solo el usuario administrador puede eliminar usuarios
export const deleteUserService = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new Error("Usuario no encontrado");

  user.isDeleted = true;
  user.deletedAt = new Date();
  await user.save();

  return { status: "success", message: "Usuario eliminado lógicamente" };
};
