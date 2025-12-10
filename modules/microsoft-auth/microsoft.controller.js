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

export const handleMicrosoftCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    // 1️⃣ Obtener tokens desde Microsoft
    const tokenResponse = await microsoftService.getTokenByAuthCode(code, redirectUri);
    const idToken = tokenResponse.idTokenClaims;

    // 2️⃣ Buscar usuario local
    let user = await UserService.findByEmail(idToken.preferred_username);

    // 3️⃣ Buscar rol por defecto
    const rolesList = await List.findOne({ name: "Roles de Usuario" });
    const defaultRole = rolesList?.items.find(i => i.value === "agente");

    if (!defaultRole) {
      throw new Error("No se encontró el rol 'agente' en la lista.");
    }

    // 4️⃣ Actualizar o crear
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
        role: defaultRole.value,  // 🔥 GUARDAMOS SOLO el string ("agente")
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
      sameSite: "None"
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None"
    });

    // 7️⃣ Construir respuesta igual al login normal
    const userResponse = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role   // 🔥 IMPORTANTE: SOLO EL STRING
    };

    const responseJson = {
      status: "success",
      user: userResponse,
      message: "Login correcto"
    };

    // 8️⃣ Codificar en Base64 para enviar vía redirect
    const encoded = Buffer.from(JSON.stringify(responseJson)).toString("base64");

    return res.redirect(`https://ticketplatform.pages.dev/auth/callback?session=${encoded}`);

  } catch (error) {
    console.error("❌ Error en handleMicrosoftCallback:", error);
    return res.redirect("https://ticketplatform.pages.dev/login?error=auth_failed");
  }
};

