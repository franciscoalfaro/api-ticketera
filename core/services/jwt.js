// src/core/services/jwt.js
import dotenv from "dotenv";
dotenv.config();

import jwt from "jwt-simple";
import moment from "moment";

const secret_key = process.env.SECRET_KEY;
const refresh_secret_key = process.env.REFRESH_SECRET_KEY;

export const createToken = (user) => {
  const payload = {
    id: user._id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    role: user.role,
    iat: moment().unix(),
    exp: moment().add(1, "days").unix() // Short lifespan for access token
  };
  return jwt.encode(payload, secret_key);
};

export const createRefreshToken = (user) => {
  const payload = {
    id: user._id,
    iat: moment().unix(),
    exp: moment().add(30, "days").unix() // Long lifespan for refresh token
  };
  return jwt.encode(payload, refresh_secret_key);
};

export { secret_key, refresh_secret_key };
