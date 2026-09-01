// ============================================================================
// HUMANHUB: MÓDULO DE DATOS ESTÁTICOS Y CONFIGURACIONES
// Aquí se almacenan todos los catálogos del sistema.
// El prefijo "export" permite que otros archivos puedan leer esta información.
// ============================================================================

export const rolesPermitidos = {
    'director2026': { rol: 'director', sector: 'Todos', label: 'DIR. GENERAL' },
    'wash2026': { rol: 'coordinador', sector: 'WASH', label: 'COORD. WASH' },
    'nutri2026': { rol: 'coordinador', sector: 'NUTRICIÓN', label: 'COORD. NUTRICIÓN' },
    'proteccion2026': { rol: 'coordinador', sector: 'PROTECCIÓN', label: 'COORD. PROTECCIÓN' },
    'salud2026': { rol: 'coordinador', sector: 'SALUD', label: 'COORD. SALUD' },
    'campo2026': { rol: 'campo', sector: 'Varios', label: 'EQUIPO DE CAMPO' }
};

export const dbSectores = [
    { id: 'wash', nombre: 'WASH', icono: 'fa-droplet', color: 'text-cyan-500', colorBg: 'bg-cyan-50' },
    { id: 'nutricion', nombre: 'Nutrición', icono: 'fa-apple-whole', color: 'text-emerald-500', colorBg: 'bg-emerald-50' },
    { id: 'proteccion', nombre: 'Protección', icono: 'fa-shield-heart', color: 'text-purple-500', colorBg: 'bg-purple-50' },
    { id: 'salud', nombre: 'Salud', icono: 'fa-truck-medical', color: 'text-rose-500', colorBg: 'bg-rose-50' },
    { id: 'educacion', nombre: 'Educación', icono: 'fa-book-open', color: 'text-amber-500', colorBg: 'bg-amber-50' }
];

export const dbTemas = {
    'wash': ['Distribución de Kits de Higiene', 'Charla de Potabilización', 'Rehabilitación de Puntos de Agua', 'Campaña de Lavado de Manos', 'Entrega de Filtros', 'Saneamiento Ambiental'],
    'nutricion': ['Tamizaje Antropométrico', 'Entrega de Suplementos (LNS-MQ)', 'Consejería en Lactancia', 'Atención a Mujeres Embarazadas', 'Desparasitación', 'Sesiones Educativas'],
    'proteccion': ['Gestión de Casos VBG', 'Apoyo Psicosocial (PSS)', 'Prevención Violencia Basada en Género', 'Asesoría Legal', 'Espacios Seguros para NNA', 'Sensibilización PEAS'],
    'salud': ['Jornada Médica General', 'Vacunación', 'Entrega de Medicamentos', 'Charlas de Salud Sexual', 'Prevención de Enfermedades Endémicas', 'Primeros Auxilios'],
    'educacion': ['Entrega de Kits Escolares', 'Nivelación Académica', 'Formación a Docentes', 'Recreación y Deporte', 'Reparación de Aulas', 'Escuelas para Padres']
};

export const dbEdades = {
    'nutricion': [
        { id: '0_5_meses', label: '0 a 5 meses' },
        { id: '6_23_meses', label: '6 a 23 meses' },
        { id: '24_59_meses', label: '24 a 59 meses' },
        { id: '5_9_anos', label: '5 a 9 años' },
        { id: '10_19_anos', label: '10 a 19 años' },
        { id: 'embarazadas', label: 'Embarazadas' },
        { id: 'lactantes', label: 'Lactantes' }
    ],
    'default': [
        { id: '0_5_anos', label: '0 a 5 años' },
        { id: '6_11_anos', label: '6 a 11 años' },
        { id: '12_17_anos', label: '12 a 17 años' },
        { id: '18_59_anos', label: '18 a 59 años' },
        { id: '60_mas', label: '60 años o más' }
    ]
};

export const adendaIndicadoresOficiales = [
    { sector: 'WASH', componente: 'Agua Segura', indicador: 'Personas con acceso a cantidad suficiente de agua segura para beber, cocinar y para la higiene personal.', meta: 1500, etiquetasIA: ['filtros', 'pastillas', 'potabilización', 'agua'] },
    { sector: 'WASH', componente: 'Saneamiento', indicador: 'Personas que utilizan instalaciones de saneamiento seguras y adecuadas.', meta: 800, etiquetasIA: ['baños', 'letrinas', 'saneamiento', 'rehabilitación'] },
    { sector: 'WASH', componente: 'Higiene', indicador: 'Personas alcanzadas con insumos críticos de higiene (Kits).', meta: 2000, etiquetasIA: ['kit de higiene', 'jabón', 'toallas', 'higiene'] },
    { sector: 'Protección', componente: 'Prevención VBG', indicador: 'Personas alcanzadas con información sobre prevención de VBG y servicios disponibles.', meta: 1200, etiquetasIA: ['vbg', 'violencia', 'prevención', 'charlas', 'sensibilización'] },
    { sector: 'Protección', componente: 'Apoyo Psicosocial', indicador: 'NNA y cuidadores que acceden a intervenciones de salud mental y apoyo psicosocial.', meta: 600, etiquetasIA: ['psicosocial', 'pss', 'psicología', 'salud mental', 'cuidadores'] },
    { sector: 'Nutrición', componente: 'Suplementación', indicador: 'Niñas y niños (6-59 meses) que reciben suplementación con micronutrientes.', meta: 950, etiquetasIA: ['lns', 'lns-mq', 'suplemento', 'micronutrientes', 'tamizaje'] },
    { sector: 'Salud', componente: 'Atención Primaria', indicador: 'Consultas de atención primaria en salud realizadas.', meta: 3000, etiquetasIA: ['consulta', 'médico', 'jornada médica', 'medicamentos'] }
];