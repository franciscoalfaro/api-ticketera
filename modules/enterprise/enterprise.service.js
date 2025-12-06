import Enterprise from "./enterprise.model.js";


// Crear empresa
export const createEnterpriseService = async ({ name, image }) => {
    const enterprise = new Enterprise({ name, image });
    return await enterprise.save();
};

// Obtener empresa por ID (solo privadas)
export const getEnterpriseByIdService = async (id) => {
    return await Enterprise.findById(id);
};

// Obtener empresa pública (solo una)
export const getPublicEnterpriseService = async () => {
    return await Enterprise.findOne({ isDeleted: false })
        .select("name image");
};

// Actualizar empresa (solo nombre)
export const updateEnterpriseService = async (id, name) => {
    return await Enterprise.findByIdAndUpdate(
        id,
        { name },
        { new: true }
    );
};

// Actualizar solo el logo
export const updateEnterpriseLogoService = async (id, image) => {
    return await Enterprise.findByIdAndUpdate(
        id,
        { image },
        { new: true }
    );
};

// Soft delete
export const deleteEnterpriseService = async (id) => {
    return await Enterprise.findByIdAndUpdate(
        id,
        {
            isDeleted: true,
            deletedAt: new Date()
        },
        { new: true }
    );
};
