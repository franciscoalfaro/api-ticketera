import { createEnterpriseService, deleteEnterpriseService, getEnterpriseByIdService, updateEnterpriseLogoService, updateEnterpriseService, getPublicEnterpriseService } from "./enterprise.service.js";
import { getUserById } from "../users/user.service.js";

// Crear empresa
export const createEnterprise = async (req, res) => {
    try {
        const { name } = req.body;
        const image = req.file?.filename || "default.png";

        const enterprise = await createEnterpriseService({ name, image });

        res.status(201).json({
            status: "success",
            message: "Empresa creada",
            enterprise
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Obtener empresa pública (solo nombre + logo)
export const getPublicEnterprise = async (req, res) => {
    try {
        const enterprise = await getPublicEnterpriseService();

        if (!enterprise) {
            return res.status(404).json({
                status: "error",
                message: "No existe información pública de empresa"
            });
        }

        const imageURL = `uploads/enterprise/${enterprise.image}`;

        res.status(200).json({
            status: "success",
            enterprise: {
                _id: enterprise._id,
                name: enterprise.name,
                image: imageURL
            }
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
};


// Obtener empresa por ID
export const getEnterprise = async (req, res) => {
    try {
        const { id } = req.params;

        const enterprise = await getEnterpriseByIdService(id);
        if (!enterprise) {
            return res.status(404).json({
                status: "error",
                message: "Empresa no encontrada"
            });
        }

        const imageURL = `uploads/enterprise/${enterprise.image}`;

        res.status(200).json({
            status: "success",
            enterprise: {
                _id: enterprise._id,
                name: enterprise.name,
                image: imageURL,
                isDeleted:enterprise.isDeleted,
            }
            
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Actualizar nombre de la empresa
export const updateEnterprise = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user.id;
        console.log("ID usuario que actualiza:", id);
        console.log("ID usuario que actualiza:", name);
        console.log("ID usuario que actualiza:", userId);

                // Buscar usuario y validar rol
        const verify = await getUserById(userId);
        console.log("Datos usuario:", verify.role);

        if (!verify) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }

        if (verify.role.value !== "admin" && verify.role.value !== "administrador") {
            return res.status(403).json({
                status: "error",
                message: "No autorizado para eliminar el logo de la empresa"
            });
        }

        const enterprise = await updateEnterpriseService(id, name);
        if (!enterprise) {
            return res.status(404).json({
                status: "error",
                message: "Empresa no encontrada"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Nombre actualizado correctamente",
            enterprise
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

// Subida de logo
export const uploadEnterpriseLogo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const image = req.file?.filename;

        // Buscar usuario y validar rol
        const verify = await getUserById(userId);
        console.log("Datos usuario:", verify.role);

        if (!verify) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }

        if (verify.role.value !== "admin" && verify.role.value !== "administrador") {
            return res.status(403).json({
                status: "error",
                message: "No autorizado para actualizar el logo de la empresa"
            });
        }

        if (!image) {
            return res.status(400).json({
                status: "error",
                message: "No se recibió archivo"
            });
        }

        const enterprise = await updateEnterpriseLogoService(id, image);
        if (!enterprise) {
            return res.status(404).json({
                status: "error",
                message: "Empresa no encontrada"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Logo actualizado correctamente",
            enterprise
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
};


// Soft delete
export const deleteEnterprise = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Buscar usuario y validar rol
        const verify = await getUserById(userId);
        console.log("Datos usuario:", verify.role);

        if (!verify) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }

        if (verify.role.value !== "admin" && verify.role.value !== "administrador") {
            return res.status(403).json({
                status: "error",
                message: "No autorizado para eliminar el logo de la empresa"
            });
        }

        const enterprise = await deleteEnterpriseService(id);
        if (!enterprise) {
            return res.status(404).json({
                status: "error",
                message: "Empresa no encontrada"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Empresa eliminada correctamente",
            enterprise
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};
