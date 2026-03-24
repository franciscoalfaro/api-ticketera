import Log from "./logs.model.js";
import mongoose from "mongoose";

// Función para crear un nuevo log en la base de datos sin controlador
export const createLog = async ({ user, action, module, description, method, status, ip }) => {
  try {
    const normalizedUser = mongoose.Types.ObjectId.isValid(user) ? user : null;

    const log = new Log({
      user: normalizedUser,
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

// Función con paginación
export const obtenerLogs = async (page = 1, limit = 10, status) => {
  try {
    const skip = (page - 1) * limit;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    const logs = await Log.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await Log.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    return {
      logs,
      pagination: {
        current: page,
        total: pages,
        limit,
        count: total,
      },
    };
  } catch (error) {
    console.error("Error obteniendo logs con paginación:", error);
    throw error;
  }
};

export const getRangeReportService = async (from, to) => {
  try {
    const logs = await Log.find({
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    }).sort({ createdAt: -1 });
    return logs;
  } catch (error) {
    console.error("Error obteniendo reporte por rango:", error);
    throw error;
  }
};

// Función con paginación para rango de fechas
export const getRangeReportServicePaginated = async (from, to, page = 1, limit = 10, status) => {
  try {
    const skip = (page - 1) * limit;
    const filter = {
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    if (status) {
      filter.status = status;
    }

    const logs = await Log.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await Log.countDocuments(filter);
    
    const pages = Math.ceil(total / limit);
    
    return {
      logs,
      pagination: {
        current: page,
        total: pages,
        limit,
        count: total,
      },
    };
  } catch (error) {
    console.error("Error obteniendo reporte por rango con paginación:", error);
    throw error;
  }
}