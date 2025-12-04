import { Router } from "express";
import { 
  createTicket, 
  getTickets, 
  getMyTickets, 
  updateTicket, 
  addTicketUpdate, 
  deleteTicket, 
  getTicketById
} from "./ticket.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { logAction } from "../../core/middlewares/logMiddleware.js";
import { createUploadMiddleware } from "../../core/middlewares/uploads.js";

const router = Router();
router.use(auth);
router.use(logAction("ticket"));

const uploadTickets = createUploadMiddleware({ folder: "tickets", prefix: "ticket-", allowedTypes: /jpeg|jpg|png|gif|pdf|docx|xlsx/,
});

router.post("/create", uploadTickets.array("attachments"), createTicket);
router.get("/all/:page", getTickets);
router.get("/mytickets/:page", getMyTickets);
router.put("/update", updateTicket);
router.post("/comment/updates", uploadTickets.array("attachments"), addTicketUpdate);
router.delete("/delete", deleteTicket);

router.get("/getticket/:id", getTicketById);

export default router;
