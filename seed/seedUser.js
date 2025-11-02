import bcrypt from "bcrypt";
import User from "../modules/users/user.model.js";
import List from "../modules/list/list.model.js";

export const userDefault = async () => {
  // Buscar la lista "Roles de Usuario"
  const rolesList = await List.findOne({ name: "Roles de Usuario" });
  if (!rolesList) {
    console.log("⚠️ No existe la lista 'Roles de Usuario'. Se omitió el seed de usuarios.");
    return;
  }

  // Buscar los roles por su value
  const adminRole = rolesList.items.find(i => i.value === "admin");
  const agenteRole = rolesList.items.find(i => i.value === "agente");

  if (!adminRole || !agenteRole) {
    console.log("⚠️ Faltan roles en la lista 'Roles de Usuario'.");
    return;
  }

  const defaultUsers = [
    {
      name: "Administrador",
      email: "admin@ticketera.local",
      password: "Admin123!",
      role: adminRole._id,
      type: "local",
    },
    {
      name: "MDS virtual",
      email: "mds_admin@ticketera.local",
      password: "MdsAdmin123!",
      role: agenteRole._id,
      type: "local",
    },
  ];

  for (const userData of defaultUsers) {
    const exists = await User.findOne({ email: userData.email, isDeleted: false });
    if (!exists) {
      const microsoftId = `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      await User.create({
        ...userData,
        microsoftId,
        password: hashedPassword,
      });

      console.log(`✅ Usuario creado: ${userData.name}`);
    } else {
      console.log(`ℹ️ Usuario existente: ${userData.name}, se omitió.`);
    }
  }

  console.log("✅ Inicialización de usuarios completada.");
};