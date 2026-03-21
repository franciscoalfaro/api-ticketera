// microsoft.routes.js
import { Router } from "express";
import {redirectToMicrosoftLogin,handleMicrosoftCallback } from '../microsoft-auth/microsoft.controller.js';
// import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = Router();
// router.use(logAction("microsoft-auth"));

router.get("/login", redirectToMicrosoftLogin);
router.get("/callback", handleMicrosoftCallback);

export default router;
