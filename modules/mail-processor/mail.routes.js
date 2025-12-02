import express from "express";
import { obtenerMails } from "./mail.controller.js";
import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = express.Router();

router.use(logAction("mail-processor"));

router.get("/fetch",obtenerMails)

export default router;
