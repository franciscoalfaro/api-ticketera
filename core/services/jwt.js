// src/core/services/jwt.js
import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import crypto from "crypto";

const secret_key = process.env.SECRET_KEY;
const refresh_secret_key = process.env.REFRESH_SECRET_KEY;

const resolveUserId = (user = {}) => user._id || user.id || null;

export const createToken = (user) => {
  const userId = resolveUserId(user);

  const payload = {
    id: userId,
    name: user.name,
    surname: user.surname,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, secret_key, {
    expiresIn: "1d",
    jwtid: crypto.randomUUID(),
  });
};

export const createRefreshToken = (user) => {
  const userId = resolveUserId(user);

  return jwt.sign(
    { id: userId },
    refresh_secret_key,
    {
      expiresIn: "30d",
      jwtid: crypto.randomUUID(),
    }
  );
};

export const verifyAccessToken = (token) => jwt.verify(token, secret_key);

export const verifyRefreshToken = (token) => jwt.verify(token, refresh_secret_key);

export { secret_key, refresh_secret_key };
