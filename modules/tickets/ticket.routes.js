import { Router } from "express";
import multer from "multer";
import {
  createTicket,
  getTickets,
  addAttachments,
  deleteTicket,
} from "./ticket.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = Router();
router.use(auth);
router.use(logAction("ticket"));


// Configuración de subida
const storage = multer.diskStorage({
  destination: "uploads/tickets/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Rutas
router.post("/create", upload.array("attachments"), createTicket);
router.get("/all", getTickets);
router.post("/:id/attachments", upload.array("attachments"), addAttachments);
router.delete("/:id", deleteTicket);

export default router;
