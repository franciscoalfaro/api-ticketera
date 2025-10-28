import Log from "../../models/log.js";

export const createLog = async ({ user, action, module, description, method, status, ip }) => {
  try {
    const log = new Log({
      user: user || null,
      action,
      module,
      description,
      method,
      status,
      ip,
    });
    await log.save();
    return log;
  } catch (error) {
    console.error("Error guardando log:", error);
  }
};
