import * as microsoftService from "./microsoft.service.js";
import * as UserService from "../users/user.service.js";
import List from "../list/list.model.js";
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

    // 1️⃣ Obtener tokens e información del usuario desde Microsoft
    const tokenResponse = await microsoftService.getTokenByAuthCode(code, redirectUri);
    const idToken = tokenResponse.idTokenClaims;

    // 2️⃣ Buscar usuario existente por correo
    let user = await UserService.findByEmail(idToken.preferred_username);

    // 3️⃣ Buscar rol por defecto
    const rolesList = await List.findOne({ name: "Roles de Usuario" });
    const defaultRole = rolesList?.items.find(i => i.value === "agente");

    if (!defaultRole) {
      throw new Error("No se encontró el rol 'agente' en la lista de roles.");
    }

    // 4️⃣ Actualizar o crear usuario
    if (user) {
      if (!user.microsoftId) {
        user.microsoftId = idToken.oid;
        user.type = "microsoft";
        await user.save();
      }
    } else {
      user = await UserService.create({
        name: idToken.name,
        email: idToken.preferred_username,
        microsoftId: idToken.oid,
        role: defaultRole._id,
        type: "microsoft",
      });
    }

    // 5️⃣ Generar tokens
    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    // 6️⃣ Guardar cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });

    // 7️⃣ Crear JSON idéntico al login manual
    const responseData = {
      status: "success",
      user,
      message: "Login Microsoft correcto"
    };

    // 8️⃣ Codificar JSON en base64 para enviarlo limpio
    const encoded = Buffer.from(JSON.stringify(responseData)).toString("base64");

    // 9️⃣ Redirigir al frontend con info
    return res.redirect(`https://ticketplatform.pages.dev/auth/callback?session=${encoded}`);

  } catch (error) {
    console.error("❌ Error en handleMicrosoftCallback:", error);
    return res.redirect("https://ticketplatform.pages.dev/login?error=auth_failed");
  }
};
