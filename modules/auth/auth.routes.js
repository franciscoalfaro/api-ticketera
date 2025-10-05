import express from "express";
import { login, logout, register } from "./auth.controller.js";
import { auth } from '../../core/middlewares/authMiddleware.js';

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post('/logout',auth, logout);

export default router;
