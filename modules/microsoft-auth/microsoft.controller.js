import * as microsoftService from "./microsoft.service.js";
import * as UserService from "../users/user.service.js";
import { createToken, createRefreshToken } from "../../core/services/jwt.js";

export const redirectToMicrosoftLogin = async (req, res, next) => {
  try {
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    const authUrl = await microsoftService.getAuthUrl(redirectUri);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

export const handleMicrosoftCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    //  Obtener tokens de Microsoft
    const tokenResponse = await microsoftService.getTokenByAuthCode(code, redirectUri);
    const idToken = tokenResponse.idTokenClaims;

    // Buscar usuario en MongoDB
    let user = await UserService.findByEmail(idToken.preferred_username);

    // Crear usuario si no existe
    if (!user) {
      user = await UserService.create({
        name: idToken.name,
        email: idToken.preferred_username,
        microsoftId: idToken.oid,
        role: "agente",
      });
    }

    // Generar JWT interno
    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    // Guardar tokens en cookies HTTP-only
    res.cookie('access_token', accessToken, { httpOnly: true, secure: true, sameSite: 'None' });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'None' });

    // Enviar respuesta al frontend
    res.json({
      status: "success",
      user,
      message: "login correcto con Microsoft"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Error interno al autenticar con Microsoft"
    });
  }
};
