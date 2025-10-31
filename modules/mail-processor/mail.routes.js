import { Router } from "express";
import { fetchUnreadEmails } from "./mail.listener.js";

const router = Router();

// Leer correos no leídos manualmente
router.get("/fetch", async (req, res) => {
  try {
    const accessToken = process.env.MS_GRAPH_TOKEN;
    await fetchUnreadEmails(accessToken);
    res.json({ status: "success", message: "Correos procesados" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
