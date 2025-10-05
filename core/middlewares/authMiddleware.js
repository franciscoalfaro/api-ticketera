// src/core/middlewares/authMiddleware.js
import jwt from "jwt-simple";
import moment from "moment";
import { secret_key, refresh_secret_key, createToken } from "../services/jwt.js";
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
    let payload = jwt.decode(token, secret_key, true);

    if (payload.exp <= moment().unix()) {
      // Token expirado, intentar renovar
      const refreshToken = req.cookies.refresh_token;
      if (!refreshToken) {
        return res.status(401).send({
          status: "error",
          message: "Refresh token missing"
        });
      }

      try {
        let refreshPayload = jwt.decode(refreshToken, refresh_secret_key);
        if (refreshPayload.exp <= moment().unix()) {
          return res.status(401).send({
            status: "error",
            message: "Refresh token expired"
          });
        }

        // Generar nuevo access token
        const newAccessToken = createToken({ id: refreshPayload.id });
        res.cookie("access_token", newAccessToken, { httpOnly: true, secure: true, sameSite: "strict" });

        // Actualizar la solicitud con el nuevo access token
        req.cookies.access_token = newAccessToken;
        payload = jwt.decode(newAccessToken, secret_key);
      } catch (error) {
        console.error("Error decoding refresh token:", error);
        return res.status(401).send({
          status: "error",
          message: "Invalid refresh token"
        });
      }
    }

    req.user = payload;

  } catch (error) {
    console.error("Error decoding access token:", error);
    return res.status(404).send({
      status: "error",
      message: "Token inválido"
    });
  }

  next();
};
