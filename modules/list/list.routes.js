import express from "express";
import { addItemController, createListController, deleteItemController, getAllListsController } from "./list.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";

const router = express.Router();
router.use(auth);

// Rutas principales
router.get("/listall", getAllListsController);
router.post("/create",  createListController);

// Subrutas para items
router.post("/add/:listId/items", addItemController);
router.delete("/delete", deleteItemController);

export default router;
