import List from "../modules/list/list.model.js";

export const seedDefaultLists = async () => {
  const defaultLists = [
    {
      name: "Roles de Usuario",
      type: "sistema",
      description: "Roles disponibles para los usuarios del sistema",
      items: [
        { label: "Administrador", value: "admin" },
        { label: "Agente", value: "agente"},
        { label: "Cliente", value: "cliente"},
        { label: "Invitado", value: "invitado"},
        { label: "MDS Virtual", value: "mds_virtual"},
      ],
    },
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
        { label: "Baja", value: "baja" },
        { label: "Media", value: "media" },
        { label: "Alta", value: "alta" },
      ],
    },
    {
      name: "Estados de Ticket",
      type: "ticket",
      description: "Estados por los que pasa un ticket",
      items: [
        { label: "Abierto", value: "open" },
        { label: "Pendiente", value: "pending" },
        { label: "Cerrado", value: "closed" },
      ],
    },
    {
      name: "Tipos de Ticket",
      type: "ticket",
      description: "Tipos de ticket que se pueden registrar",
      items: [],
    },
    {
      name: "Medios de Reporte",
      type: "ticket",
      description: "Origen desde donde se reporta un ticket",
      items: [],
    },
  ];

  for (const listData of defaultLists) {
    const exists = await List.findOne({ name: listData.name, isDeleted: false });
    if (!exists) {
      await List.create(listData);
      console.log(`✅ Lista creada: ${listData.name}`);
    } else {
      console.log(`ℹ️ Lista existente: ${listData.name}, se omitió.`);
    }
  }

  console.log("✅ Inicialización de listas completada.");
};
