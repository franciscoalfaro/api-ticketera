import express from "express";
import { login, logout, register } from "./auth.controller.js";
import { auth } from '../../core/middlewares/authMiddleware.js';
import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = express.Router();
router.use(logAction("auth"));

router.post("/login", login);
router.post("/register", register);
router.post('/logout',auth, logout);

export default router;
