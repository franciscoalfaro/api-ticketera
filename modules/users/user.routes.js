import express from "express";
import * as UserController from "./user.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";

const router = express.Router();

// Todas las rutas protegidas con auth middleware
router.use(auth);

router.get("/listusers", UserController.getUsers);
router.get("/getuser/:id", UserController.getUser);
router.get("/getprofile", UserController.getUserProfile);
router.post("/create", UserController.createUser);
router.put("/update/:id", UserController.updateUser);
router.delete("/delete/:id", UserController.deleteUser);

export default router;
