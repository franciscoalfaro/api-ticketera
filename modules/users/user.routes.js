import express from "express";
import {activateUser, createUser, deleteUser, getAssignableUsers, getUser, getUserProfile, getUsers, updateUser } from "./user.controller.js";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = express.Router();
router.use(logAction("users"));
// Todas las rutas protegidas con auth middleware
router.use(auth);

//listar todos los usuarios 
router.get("/listusers/:page", getUsers);

//Listar todos los usuarios que son distintos para asignar ticket 
router.get("/available", getAssignableUsers); // 

router.get("/getuser/:id", getUser);
router.get("/getprofile", getUserProfile);
router.post("/create", createUser);
router.put("/update", updateUser);
router.put("/reactivate/:id", activateUser);
router.delete("/delete/:id", deleteUser);

export default router;
