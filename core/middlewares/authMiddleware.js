// src/core/middlewares/authMiddleware.js
import { createToken, verifyAccessToken, verifyRefreshToken } from "../services/jwt.js";
import { isBlacklisted } from "../services/tokenBlacklist.js";

export const auth = async (req, res, next) => {
  if (!req.cookies.access_token) {
    return res.status(403).send({
      status: "error",
      message: "La petición no tiene cabecera de autenticación."
    });
  }

  let token = req.cookies.access_token;

  if (await isBlacklisted(token)) {
    return res.status(401).send({
      status: "error",
      message: "Token revocado"
    });
  }

  try {
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      if (error.name !== "TokenExpiredError") {
        throw error;
      }

      const refreshToken = req.cookies.refresh_token;
      if (!refreshToken) {
        return res.status(401).send({
          status: "error",
          message: "Refresh token missing"
        });
      }

      if (await isBlacklisted(refreshToken)) {
        return res.status(401).send({
          status: "error",
          message: "Refresh token revocado"
        });
      }

      try {
        const refreshPayload = verifyRefreshToken(refreshToken);

        // Generar nuevo access token
        const newAccessToken = createToken({ id: refreshPayload.id });
        res.cookie("access_token", newAccessToken, { httpOnly: true, secure: true, sameSite: "Strict" });

        // Actualizar la solicitud con el nuevo access token
        req.cookies.access_token = newAccessToken;
        payload = verifyAccessToken(newAccessToken);
      } catch (error) {
        console.error("Error decoding refresh token:", error);
        const message = error.name === "TokenExpiredError" ? "Refresh token expired" : "Invalid refresh token";
        return res.status(401).send({
          status: "error",
          message
        });
      }
    }

    req.user = payload;

  } catch (error) {
    console.error("Error decoding access token:", error);
    return res.status(401).send({
      status: "error",
      message: "Token inválido"
    });
  }

  next();
};
