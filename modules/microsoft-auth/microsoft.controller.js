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

    //  Buscar usuario en MongoDB por email
    let user = await UserService.findByEmail(idToken.preferred_username);

    if (user) {
      //  Si el usuario existe pero no tiene microsoftId, actualízalo
      if (!user.microsoftId) {
        user.microsoftId = idToken.oid;
        user.type = "microsoft";
        await user.save();
      }
    } else {
      //  Si no existe, créalo
      user = await UserService.create({
        name: idToken.name,
        email: idToken.preferred_username,
        microsoftId: idToken.oid,
        role: "agente",
        type: "microsoft",
      });
    }

    // 5️⃣ Generar JWT interno
    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    // Guardar tokens en cookies seguras
    res.cookie('access_token', accessToken, { httpOnly: true, secure: true, sameSite: 'None' });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'None' });

    // Redirigir al frontend
    res.redirect("http://localhost:3000/#/dashboard");
  } catch (error) {
    console.error("Error en handleMicrosoftCallback:", error);
    res.redirect("http://localhost:5173/login?error=auth_failed");
  }
};
