// microsoft.routes.js
import { Router } from "express";
import {redirectToMicrosoftLogin,handleMicrosoftCallback } from '../microsoft-auth/microsoft.controller';

const router = Router();

router.get("/login", redirectToMicrosoftLogin);
router.get("/callback", handleMicrosoftCallback);

export default router;
