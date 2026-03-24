import express from "express";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { aiClassifierStatus, classifyEmailPreview, classifyManualTicketDraft } from "./ai-ticket.controller.js";
import { askAgent, askAgentStream } from "./ai-ticket.agent.controller.js";

const router = express.Router();

router.use(auth);
router.get("/status", aiClassifierStatus);
router.post("/classify-email", classifyEmailPreview);
router.post("/classify-ticket-draft", classifyManualTicketDraft);
router.post("/ask", askAgent);
router.post("/ask-stream", askAgentStream);

export default router;
