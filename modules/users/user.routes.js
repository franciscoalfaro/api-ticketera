import express from "express";
import {activateUser, createUser, deleteUser, getUser, getUserProfile, getUsers, updateUser } from "./user.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";

const router = express.Router();

// Todas las rutas protegidas con auth middleware
router.use(auth);

router.get("/listusers", getUsers);
router.get("/getuser/:id", getUser);
router.get("/getprofile", getUserProfile);
router.post("/create", createUser);
router.put("/update/:id", updateUser);
router.put("/reactivate/:id", activateUser);
router.delete("/delete/:id", deleteUser);

export default router;
