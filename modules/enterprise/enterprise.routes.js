import express from "express";
import { createEnterprise, deleteEnterprise, getEnterprise, getPublicEnterprise, updateEnterprise, uploadEnterpriseLogo } from "./enterprise.controller.js";
import { createUploadMiddleware } from "../../core/middlewares/uploads.js";
import { auth } from "../../core/middlewares/authMiddleware.js";
import { logAction } from "../../core/middlewares/logMiddleware.js";

const router = express.Router();

// Ruta pública: obtener nombre y logo
router.get("/public", getPublicEnterprise);
router.use(auth);
router.use(logAction("enterprise"));

const uploadNameEnteprise= createUploadMiddleware({ folder: "enterprise", prefix: "enterprise-", allowedTypes: /jpeg|jpg|png|gif/,
});

//ruta de creacion de empresa
router.post("/create", createEnterprise);

//ruta de obtencion de datos de la empresa
router.get("/get/:id", getEnterprise);

//ruta de actualizacion de datos de la empresa
router.put("/update/:id", updateEnterprise);

//ruta de eliminacion de la empresa
router.delete("/delete/:id", deleteEnterprise);

//ruta de subida de logo de la empresa
router.post("/uploadlogo/:id",[uploadNameEnteprise.single("file0")], uploadEnterpriseLogo);



export default router;