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

    // Obtener tokens
    const tokenResponse = await microsoftService.getTokenByAuthCode(code, redirectUri);
    const idToken = tokenResponse.idTokenClaims;

    // Buscar usuario existente
    let user = await UserService.findByEmail(idToken.preferred_username);

    // Buscar lista de roles
    const rolesList = await List.findOne({ name: "Roles de Usuario" });
    const defaultRole = rolesList?.items.find(i => i.value === "agente");

    if (!defaultRole) {
      throw new Error("No se encontró el rol 'agente' en la lista de roles.");
    }

    // Crear o actualizar usuario
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

    // ENRIQUECER EL ROL (siempre DESPUÉS de tener user.role)
    let roleEnriched = rolesList.items.find(
      (item) => item._id.toString() === user.role.toString()
    );

    // Generar tokens
    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    // Cookies
    res.cookie("access_token", accessToken, {httpOnly: true,secure: true,sameSite: "None"});

    res.cookie("refresh_token", refreshToken, {httpOnly: true, secure: true, sameSite: "None"});

    // Crear JSON igual que el login normal
    const responseJson = {
      status: "success",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: roleEnriched.value    
      },
      message: "Login correcto"
    };

    // Codificar JSON en base64
    const encoded = Buffer.from(JSON.stringify(responseJson)).toString("base64");

    // Redirigir a tu frontend con el JSON incrustado
    res.redirect("https://ticketplatform.pages.dev/dashboard");
  } catch (error) {
    console.error("❌ Error en handleMicrosoftCallback:", error);
    return res.redirect("https://ticketplatform.pages.dev/login?error=auth_failed");
  }
};

