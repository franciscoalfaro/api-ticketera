import { createLog } from "../services/log.service.js";

export const logAction = (module) => {
  return async (req, res, next) => {
    res.on("finish", async () => {
      // Guardar solo si no es ruta de logs
      if (!req.originalUrl.includes("/logs")) {
        await createLog({
          user: req.user.id,
          action: `${req.method} ${req.originalUrl}`,
          module,
          description: res.statusCode < 400 ? "Acción exitosa" : "Acción con error",
          method: req.method,
          status: res.statusCode < 400 ? "success" : "error",
          ip: req.ip,
        });
      }
    });
    next();
  };
};
