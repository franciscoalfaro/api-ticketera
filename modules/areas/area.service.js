import Area from "./area.model.js";

export const createAreaService = async ({ name, description }) => {
  const existing = await Area.findOne({ name });
  if (existing) throw new Error("Ya existe un área con este nombre.");
  return await Area.create({ name, description });
};

export const getAreasService = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [areas, total] = await Promise.all([
    Area.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Area.countDocuments({ isDeleted: false }),
  ]);
  return { areas, currentPage: page, totalPages: Math.ceil(total / limit) };
};

export const getAreaByIdService = async (id) => {
  const area = await Area.findById(id);
  if (!area || area.isDeleted) throw new Error("Área no encontrada.");
  return area;
};

export const updateAreaService = async (id, data) => {
  const area = await Area.findById(id);
  if (!area || area.isDeleted) throw new Error("Área no encontrada.");
  Object.assign(area, data, { updatedAt: new Date() });
  await area.save();
  return area;
};

export const deleteAreaService = async (id) => {
  const area = await Area.findById(id);
  if (!area) throw new Error("Área no encontrada.");
  area.isDeleted = true;
  area.deletedAt = new Date();
  await area.save();
  return { status: "success", message: "Área eliminada lógicamente" };
};
