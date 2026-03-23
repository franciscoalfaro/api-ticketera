import * as microsoftService from "./microsoft.service.js";
import * as UserService from "../users/user.service.js";
import List from "../list/list.model.js";
import { createToken, createRefreshToken } from "../../core/services/jwt.js";
import { createLog } from "../logs/logs.service.js";

const ADMIN_KEYWORDS = ["admin", "administrador", "supervisor", "jefe"];

const resolveRoleValueByJobTitle = (jobTitle = "") => {
  const normalized = String(jobTitle).toLowerCase().trim();
  const isAdmin = ADMIN_KEYWORDS.some((keyword) => normalized.includes(keyword));
  return isAdmin ? "admin" : "agente";
};

export const redirectToMicrosoftLogin = async (req, res, next) => {
  try {
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    const authUrl = await microsoftService.getAuthUrl(redirectUri);
    await createLog({
      user: req.user?.id,
      action: "REDIRECT_MICROSOFT_LOGIN",
      module: "microsoft-auth",
      description: "Redirección a login de Microsoft",
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });
    res.redirect(authUrl);
  } catch (error) {
    await createLog({
      user: req.user?.id,
      action: "ERROR_REDIRECT_MICROSOFT_LOGIN",
      module: "microsoft-auth",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
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
    const msProfile = await microsoftService.getMicrosoftProfile(tokenResponse.accessToken);
    const userEmail = idToken.preferred_username || msProfile.mail || msProfile.userPrincipalName;

    console.log("[MS_LOGIN] Perfil recibido desde Microsoft:", {
      email: userEmail,
      displayName: msProfile.displayName || idToken.name || null,
      jobTitle_profile: msProfile.jobTitle || null,
      jobTitle_claim: idToken.jobTitle || idToken.job_title || null,
      oid: idToken.oid || null,
    });

    if (!userEmail) {
      throw new Error("No se pudo obtener email del usuario Microsoft");
    }

    const roleValueToAssign = resolveRoleValueByJobTitle(msProfile.jobTitle);
    console.log("[MS_LOGIN] Mapeo de rol por jobTitle:", {
      jobTitle: msProfile.jobTitle || null,
      resolvedRoleValue: roleValueToAssign,
    });

    // Buscar usuario existente
    let user = await UserService.findByEmail(userEmail);

    // Buscar lista de roles
    const rolesList = await List.findOne({ name: "Roles de Usuario", isDeleted: false }).lean();
    const targetRole = rolesList?.items?.find(
      (i) => i.value === roleValueToAssign && !i.isDeleted
    );

    console.log("[MS_LOGIN] Rol objetivo encontrado en lista:", {
      roleValueToAssign,
      roleId: targetRole?._id?.toString() || null,
      roleLabel: targetRole?.label || null,
    });

    if (!targetRole) {
      throw new Error(`No se encontró el rol '${roleValueToAssign}' en la lista de roles.`);
    }

    // Crear o actualizar usuario
    if (user) {
      console.log("[MS_LOGIN] Usuario existente antes de actualizar:", {
        userId: user._id?.toString(),
        email: user.email,
        currentRoleId: user.role?.toString?.() || null,
        currentType: user.type,
      });

      const mustUpdateMicrosoftIdentity = !user.microsoftId || user.microsoftId !== idToken.oid;
      const mustUpdateType = user.type !== "microsoft";
      const mustUpdateRole = !user.role || user.role.toString() !== targetRole._id.toString();

      if (mustUpdateMicrosoftIdentity || mustUpdateType || mustUpdateRole) {
        user.microsoftId = idToken.oid;
        user.type = "microsoft";
        user.role = targetRole._id;
        await user.save();

        console.log("[MS_LOGIN] Usuario actualizado por login Microsoft:", {
          userId: user._id?.toString(),
          updatedRoleId: user.role?.toString?.() || null,
          updatedType: user.type,
          updatedMicrosoftId: !!user.microsoftId,
        });
      }
    } else {
      user = await UserService.create({
        name: idToken.name || msProfile.displayName || userEmail,
        email: userEmail,
        microsoftId: idToken.oid,
        role: targetRole._id,
        type: "microsoft",
      });

      console.log("[MS_LOGIN] Usuario creado por login Microsoft:", {
        userId: user._id?.toString(),
        email: user.email,
        roleId: user.role?.toString?.() || null,
        roleValue: roleValueToAssign,
      });
    }

    // ENRIQUECER EL ROL (siempre DESPUÉS de tener user.role)
    let roleEnriched = rolesList.items.find(
      (item) => item._id.toString() === user.role.toString()
    );

    console.log("[MS_LOGIN] Rol final enriquecido:", {
      userId: user._id?.toString(),
      roleId: user.role?.toString?.() || null,
      roleValue: roleEnriched?.value || null,
    });

    // Generar tokens
    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    // Cookies
    res.cookie('access_token', accessToken, { httpOnly: true, secure: true, sameSite: 'None' });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'None' });

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
    await createLog({
      user: user?._id,
      action: "LOGIN_MICROSOFT",
      module: "microsoft-auth",
      description: `Login Microsoft correcto: ${user?.email}`,
      status: "success",
      method: "GET",
      ip: req.clientIp,
    });

    res.redirect("https://ticketplatform.pages.dev/dashboard");
  } catch (error) {
    console.error("❌ Error en handleMicrosoftCallback:", error);
    await createLog({
      user: null,
      action: "ERROR_LOGIN_MICROSOFT",
      module: "microsoft-auth",
      description: error.message,
      status: "error",
      method: "GET",
      ip: req.clientIp,
    });
    return res.redirect("https://ticketplatform.pages.dev/login?error=auth_failed");
  }
};

