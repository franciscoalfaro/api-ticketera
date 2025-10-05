import User from "../users/user.model.js";
import bcrypt from "bcrypt";
import { createToken, createRefreshToken } from "../../core/services/jwt.js";
import { addToBlacklist } from '../../core/services/tokenBlacklist.js';

export const loginService = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    return { status: 404, message: "Usuario no encontrado" };
  }

  if (!user.password) {
    return { status: 400, message: "Usuario registrado vía Microsoft, usar ese login" };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { status: 401, message: "Contraseña incorrecta" };
  }

  const accessToken = createToken(user);
  const refreshToken = createRefreshToken(user);

  return {
    status: 200,
    user: { id: user._id, email: user.email, name: user.name, role:user.role},
    accessToken,
    refreshToken
  };
};

export const registerService = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    return { status: 400, message: "Usuario ya existe" };
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, role });

  return {
    status: 201,
    user: { id: user._id, email: user.email, name: user.name, role:user.role},

  };
};

export const registerServiceLocal = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    return { status: 400, message: "Usuario ya existe" };
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    name,
    email,
    password: hashedPassword,
    role,
    type: 'local',  // Importante diferenciar
  });

  await newUser.save();
  return newUser;
};



export const logoutService = async (accessToken, refreshToken) => {
  try {
    if (accessToken) {
      await addToBlacklist(accessToken);
    }

    if (refreshToken) {
      await addToBlacklist(refreshToken);
    }

    return { status: 200, message: "Sesión cerrada correctamente" };
  } catch (error) {
    console.error("Error en logoutService:", error);
    return { status: 500, message: "Error al cerrar sesión" };
  }
};
