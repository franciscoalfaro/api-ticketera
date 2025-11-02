import Area from "../areas/area.model.js";
import List from "../list/list.model.js";
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



export const getAllUsersService = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [users, total, rolesList] = await Promise.all([
    User.find({})
      .populate("area", "name color")
      .select("-password")
      .skip(skip)
      .limit(limit),
    User.countDocuments({}),
    List.findOne({ name: "Roles de Usuario" }),
  ]);

  const enrichedUsers = users.map(user => {
    const role = rolesList.items.id(user.role); // buscar por _id dentro del array
    return {
      ...user.toObject(),
      role: role ? { value: role.value, id:role._id} : null,
    };
  });

  return {
    users: enrichedUsers,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  };
};


// Obtener todos los usuarios asignables (todas las áreas excepto "Clientes")
export const getAssignableUsersService = async () => {
  const nonClientAreas = await Area.find({
    isDeleted: false,
    name: { $ne: "cliente" }
  }).select("_id");

  const allowedAreaIds = nonClientAreas.map(a => a._id);

  // 🔹 Incluir usuarios sin área también (si quieres que aparezcan)
  const users = await User.find({
      isDeleted: false,
      $or: [
        { area: { $in: allowedAreaIds } },
        { area: null } // permite listar usuarios sin área definida
      ]
    })
    .populate("area", "name color")
    .select("name email role area")
    .sort({ "area.name": 1, name: 1 });

  const rolesList = await List.findOne({ name: "Roles de Usuario", isDeleted: false });

  const enrichedUsers = users.map(user => {
    const role = rolesList?.items.id(user.role);
    return {
      ...user.toObject(),
      role: role
        ? { label: role.label, value: role.value, color: role.color }
        : null
    };
  });

  return enrichedUsers;
};


// Obtener usuario por ID
export const getUserById = async (id) => {
  // Buscar el usuario con su área
  const user = await User.findById(id)
    .populate("area", "name color")
    .select("-password");

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  // Buscar la lista de roles
  const rolesList = await List.findOne({ name: "Roles de Usuario", isDeleted: false });

  // Buscar el rol correspondiente dentro de la lista
  const role = rolesList?.items?.id(user.role);

  // Enriquecer la respuesta
  const enrichedUser = {
    ...user.toObject(),
    role: role
      ? { label: role.label, value: role.value, color: role.color }
      : null,
  };

  return enrichedUser;
};

// Crear un usuario manual (opcional, además de auth.register, se debe de incrementar el id, validando previamente que microsoftId no este en uso  )
export const createUserService = async ({ name, email, password, role, area }) => {
  try {
    // Normalizar datos
    const userRole = role?.toLowerCase() || "cliente";

    // Validar campos requeridos según el rol
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

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const error = new Error("El correo electrónico no tiene un formato válido.");
      error.code = "INVALID_EMAIL";
      throw error;
    }

    // Verificar si el usuario ya existe
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      const error = new Error("El usuario ya existe.");
      error.code = "USER_EXISTS";
      throw error;
    }

    // Hashear la contraseña solo si corresponde
    let hashedPassword = undefined;
    if (password && (userRole === "agente" || userRole === "administrador")) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Crear el usuario
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword, // puede ser undefined
      role: userRole,
      area:area,
      microsoftId: `local-${Date.now()}`
    });

    await user.save();

    // Retornar datos seguros
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
