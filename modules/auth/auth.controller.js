import { loginService, logoutService, registerService } from "./auth.service.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(email, password);

    if (result.status !== 200) {
      return res.status(result.status).json({ status: "error", message: result.message });
    }

    res.cookie('access_token', result.accessToken, { httpOnly: true, secure: true, sameSite: 'None' });
    res.cookie('refresh_token', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'None' });

    res.json({ status: "success", user: result.user, message: "Login correcto" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await registerService({ name, email, password, role });

    if (result.status !== 201) {
      return res.status(result.status).json({ status: "error", message: result.message });
    }

    res.json({ status: "success", user: result.user, message: "Usuario creado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
};

export const logout = async (req, res) => {
  const accessToken = req.cookies.access_token;
  const refreshToken = req.cookies.refresh_token;

  const result = await logoutService(accessToken, refreshToken);

  // 🔥 ELIMINAR COOKIES CORRECTAMENTE
  res.clearCookie('accessToken',accessToken, { httpOnly: true, secure: true, sameSite: "None",});

  res.clearCookie('refreshToken',refreshToken, { httpOnly: true, secure: true, sameSite: "None", });

  return res.status(result.status).json({
    status: result.status === 200 ? "success" : "error",
    message: result.message,
  });
};
