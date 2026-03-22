import { Router } from "express";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { getAllLogs, getRangeReportController } from "./logs.controller.js";

const router = Router();
router.use(auth);

router.get("/",getAllLogs)
router.post("/filter",getRangeReportController)


export default router;
