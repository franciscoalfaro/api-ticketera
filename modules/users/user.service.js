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
  try {
    // Normalizar datos
    const userRole = role?.toLowerCase() || "cliente";

    // 🔍 Validar campos requeridos según el rol
    if (!name || !email) {
      const error = new Error("Faltan campos requeridos (name o email).");
      error.code = "MISSING_FIELDS";
      throw error;
    }

    // Solo agente o administrador requieren contraseña
    if ((userRole === "agente" || userRole === "administrador") && !password) {
      const error = new Error("El campo password es requerido para agentes y administradores.");
      error.code = "MISSING_PASSWORD";
      throw error;
    }

    // ✅ Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const error = new Error("El correo electrónico no tiene un formato válido.");
      error.code = "INVALID_EMAIL";
      throw error;
    }

    // ✅ Verificar si el usuario ya existe
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      const error = new Error("El usuario ya existe.");
      error.code = "USER_EXISTS";
      throw error;
    }

    // 🔐 Hashear la contraseña solo si corresponde
    let hashedPassword = undefined;
    if (password && (userRole === "agente" || userRole === "administrador")) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 🧩 Crear el usuario
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword, // puede ser undefined
      role: userRole,
      microsoftId: `local-${Date.now()}`
    });

    await user.save();

    // 🔒 Retornar datos seguros
    const safeUser = user.toObject();
    delete safeUser.password;

    return safeUser;

  } catch (err) {
    console.error("Error en createUserService:", err.message);

    if (err.code) throw err;

    const error = new Error("Error interno al crear el usuario.");
    error.code = "INTERNAL_ERROR";
    throw error;
  }
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
