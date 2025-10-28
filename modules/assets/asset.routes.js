import express from "express";

import { logAction } from "../../core/middlewares/logMiddleware.js";
import { createAsset, deleteAsset, getAllAssets, getAssetById, updateAsset } from "./asset.controller.js";

import { auth } from "../../core/middlewares/authMiddleware.js";

const router = express.Router();

// Todas las rutas protegidas con auth middleware
router.use(auth);

router.use(logAction("assets"));

router.get("/allasset/:page", getAllAssets);
router.get("/get/:id", getAssetById);
router.post("/create", createAsset);
router.put("/update/:id", updateAsset);
router.delete("/delete/:id", deleteAsset);

export default router;
