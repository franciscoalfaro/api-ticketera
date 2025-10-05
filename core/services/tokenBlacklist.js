// src/core/services/tokenBlacklist.js
import TokenBlacklist from "../../models/tokenBlacklist.js";

export const addToBlacklist = async (token) => {
  if (!token) return;

  const cleanedToken = token.trim();
  const blacklistedToken = await TokenBlacklist.findOne({ token: cleanedToken });

  if (!blacklistedToken) {
    const newBlacklistedToken = new TokenBlacklist({ token: cleanedToken });
    await newBlacklistedToken.save();
  }
};

export const isBlacklisted = async (token) => {
  if (!token) return false;

  const cleanedToken = token.trim();
  const blacklistedToken = await TokenBlacklist.findOne({ token: cleanedToken });
  return !!blacklistedToken;
};
