import { loginService, logoutService, registerService } from "./auth.service.js";
import { createLog } from "../logs/logs.service.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(email, password);

    if (result.status !== 200) {
      await createLog({
        user: null,
        action: "ERROR_LOGIN",
        module: "auth",
        description: `Intento de login fallido para ${email}: ${result.message}`,
        status: "error",
        method: "POST",
        ip: req.clientIp,
      });
      return res.status(result.status).json({ status: "error", message: result.message });
    }

    res.cookie('access_token', result.accessToken, { httpOnly: true, secure: true, sameSite: 'Strict' });
    res.cookie('refresh_token', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict' });

    await createLog({
      user: result.user?.id || result.user?._id || null,
      action: "LOGIN",
      module: "auth",
      description: `Login correcto: ${result.user?.email || email}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    res.json({ status: "success", user: result.user, message: "Login correcto" });
  } catch (error) {
    console.error(error);
    await createLog({
      user: null,
      action: "ERROR_LOGIN",
      module: "auth",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await registerService({ name, email, password, role });

    if (result.status !== 201) {
      await createLog({
        user: null,
        action: "ERROR_REGISTRO",
        module: "auth",
        description: `Registro fallido para ${email}: ${result.message}`,
        status: "error",
        method: "POST",
        ip: req.clientIp,
      });
      return res.status(result.status).json({ status: "error", message: result.message });
    }

    await createLog({
      user: result.user?.id || result.user?._id || null,
      action: "REGISTRO_USUARIO",
      module: "auth",
      description: `Usuario registrado: ${result.user?.email || email}`,
      status: "success",
      method: "POST",
      ip: req.clientIp,
    });

    res.json({ status: "success", user: result.user, message: "Usuario creado correctamente" });
  } catch (error) {
    console.error(error);
    await createLog({
      user: null,
      action: "ERROR_REGISTRO",
      module: "auth",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
};

export const logout = async (req, res) => {
  try {
    const accessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;

    const result = await logoutService (accessToken, refreshToken);

    await createLog({
      user: req.user?.id,
      action: result.status === 200 ? "LOGOUT" : "ERROR_LOGOUT",
      module: "auth",
      description: result.message,
      status: result.status === 200 ? "success" : "error",
      method: "POST",
      ip: req.clientIp,
    });

    // Limpiar cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return res.status(result.status).json({
      status: result.status === 200 ? "success" : "error",
      message: result.message,
    });
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_LOGOUT",
      module: "auth",
      description: error.message,
      status: "error",
      method: "POST",
      ip: req.clientIp,
    });
    return res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
};