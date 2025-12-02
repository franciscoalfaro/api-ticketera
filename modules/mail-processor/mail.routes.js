import { Router } from "express";
import { processUnreadEmails } from "./mail.listener.js";

const router = Router();

router.get("/fetch", async (req, res) => {
  try {
    await processUnreadEmails();
    res.json({ status: "success", message: "Correos procesados" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
