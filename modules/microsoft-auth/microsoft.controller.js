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

    // 3️⃣ Buscar el rol por defecto "agente" desde la lista de roles
    const rolesList = await List.findOne({ name: "Roles de Usuario" });
    const defaultRole = rolesList?.items.find(i => i.value === "agente");

    if (!defaultRole) {
      throw new Error("No se encontró el rol 'agente' en la lista de roles.");
    }

    // 4️⃣ Si el usuario existe, actualizamos microsoftId si no lo tenía
    if (user) {
      if (!user.microsoftId) {
        user.microsoftId = idToken.oid;
        user.type = "microsoft";
        await user.save();
      }
    } else {
      // 5️⃣ Crear nuevo usuario si no existía
      user = await UserService.create({
        name: idToken.name,
        email: idToken.preferred_username,
        microsoftId: idToken.oid,
        role: defaultRole._id, // 🔹 Referencia dinámica al rol "agente"
        type: "microsoft",
      });
    }

    // 6️⃣ Generar tokens internos
    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    // 7️⃣ Guardar tokens en cookies seguras
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

    // 8️⃣ Redirigir al frontend
    res.redirect("http://localhost:3000/dashboard");
  } catch (error) {
    console.error("❌ Error en handleMicrosoftCallback:", error);
    res.redirect("http://localhost:3000/login?error=auth_failed");
  }
};
