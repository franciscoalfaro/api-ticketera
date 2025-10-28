import List from "../modules/list/list.model.js";

export const seedDefaultLists = async () => {
  const defaultLists = [
    {
      name: "Departamentos",
      type: "ticket",
      description: "Áreas de la organización que gestionan tickets",
      items: [
        { label: "Marketing", value: "marketing" },
        { label: "Facturación", value: "facturacion" },
        { label: "Instalaciones", value: "instalaciones" },
        { label: "Soporte TI", value: "soporte_ti" },
        { label: "Adquisiciones", value: "adquisiciones" },
      ],
    },
    {
      name: "Impacto",
      type: "ticket",
      description: "Nivel de afectación del ticket",
      items: [
        { label: "Un Departamento", value: "departamento" },
        { label: "Un Servicio", value: "servicio" },
        { label: "Una Persona", value: "persona" },
      ],
    },
    {
      name: "Prioridades",
      type: "ticket",
      description: "Grado de prioridad para resolución de tickets",
      items: [
        { label: "Baja", value: "baja", color: "#28a745" },
        { label: "Media", value: "media", color: "#ffc107" },
        { label: "Alta", value: "alta", color: "#dc3545" },
      ],
    },
    {
      name: "Estados de Ticket",
      type: "ticket",
      description: "Estados por los que pasa un ticket",
      items: [
        { label: "Open", value: "open", color: "#0d6efd" },
        { label: "Pending", value: "pending", color: "#ffc107" },
        { label: "Closed", value: "closed", color: "#198754" },
      ],
    },
  ];

  for (const listData of defaultLists) {
    const exists = await List.findOne({ name: listData.name, isDeleted: false });
    if (!exists) {
      await List.create(listData);
      console.log(`✅ Lista creada: ${listData.name}`);
    } else {
      console.log(`⚠️ Lista existente: ${listData.name}, se omitió.`);
    }
  }

  console.log("🎯 Inicialización de listas completada.");
};
