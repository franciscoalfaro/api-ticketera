import Asset from "./assets.model.js";

// Crear un nuevo activo
const COMPANY_PREFIX = process.env.COMPANY_PREFIX?.trim().toUpperCase() || "XX";

export const createAssetService = async (data, userId) => {
  try {
    // Desestructurar los campos válidos según el modelo
    const {
      name,
      model,
      serialNumber,
      owner,
      purchaseDate,
      description,
      status,
      location
    } = data;

    // 🧩 Validar campos requeridos
    if (!name) {
      const error = new Error("El campo 'name' es obligatorio.");
      error.code = "MISSING_NAME";
      throw error;
    }

    // 🔎 Validar duplicado de número de serie
    if (serialNumber) {
      const existingSerial = await Asset.findOne({ serialNumber, isDeleted: false });
      if (existingSerial) {
        const error = new Error(`Ya existe un activo con el número de serie '${serialNumber}'.`);
        error.code = "DUPLICATE_SERIAL";
        throw error;
      }
    }

    // 🧠 Generar código automáticamente
    const cleanName = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const serialPart = serialNumber
      ? serialNumber.replace(/\s+/g, "").toUpperCase()
      : Math.floor(Math.random() * 10000).toString();

    const generatedCode = `${COMPANY_PREFIX}-${serialPart}-${cleanName}`;

    // Verificar duplicado de código
    const existingCode = await Asset.findOne({ code: generatedCode, isDeleted: false });
    if (existingCode) {
      const error = new Error("El código generado ya existe. Intente con otro número de serie o nombre.");
      error.code = "DUPLICATE_CODE";
      throw error;
    }

    // 🏗️ Crear nuevo activo
    const newAsset = new Asset({
      code: generatedCode,
      name: name.trim(),
      model: model?.trim() || null,
      serialNumber: serialNumber?.trim() || null,
      owner: owner || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      description: description?.trim() || "",
      status: status || "stock",
      location: location?.trim() || "Oficina principal",
      createdBy: userId
    });

    await newAsset.save();

    return newAsset;
  } catch (err) {
    console.error("Error en createAssetService:", err.message);

    if (err.code) throw err;

    const error = new Error("Error interno al crear el activo.");
    error.code = "INTERNAL_ERROR";
    throw error;
  }
};

// Obtener todos los activos
export const getAllAssetsService = async (page = 1, limit = 9, status = null, search = "") => {
  const skip = (page - 1) * limit;

  const filter = { isDeleted: false };

  // Filtro por estado si se envía (activo, obsoleto, etc.)
  if (status && status !== "todos") {
    filter.status = status;
  }

  // Búsqueda general por nombre, modelo o número de serie
  if (search) {
    filter.$or = [
      { name: new RegExp(search, "i") },
      { model: new RegExp(search, "i") },
      { serialNumber: new RegExp(search, "i") },
    ];
  }

  // Conteo total para la paginación
  const total = await Asset.countDocuments(filter);

  // Consulta paginada
  const assets = await Asset.find(filter)
    .populate("owner", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    total,
    page,
    totalPages: Math.ceil(total / limit),
    results: assets
  };
};


// Obtener un activo específico
export const getAssetByIdService = async (id) => {
  const asset = await Asset.findById(id)
    .populate("owner", "name email")
    .populate("createdBy", "name email");
  if (!asset) throw new Error("Activo no encontrado");
  return asset;
};

// Actualizar activo
export const updateAssetService = async (id, data) => {
  const asset = await Asset.findById(id);
  if (!asset) throw new Error("Activo no encontrado");

  Object.assign(asset, data, { updatedAt: new Date() });
  await asset.save();
  return asset;
};

// Eliminación lógica
export const deleteAssetService = async (id) => {
  const asset = await Asset.findById(id);
  if (!asset) throw new Error("Activo no encontrado");

  asset.isDeleted = true;
  asset.deletedAt = new Date();
  await asset.save();

  return { message: "Activo eliminado lógicamente" };
};
