import express from "express";
import { addItemController, createListController, deleteItemController, getAllListsController, updateItemDeletedStatusController } from "./list.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";

const router = express.Router();
router.use(auth);

// Rutas principales
router.get("/listall", getAllListsController);
router.post("/create",  createListController);

// Subrutas para items
router.post("/add", addItemController);
router.delete("/delete", deleteItemController);

router.put("/reactivate", updateItemDeletedStatusController);

export default router;
