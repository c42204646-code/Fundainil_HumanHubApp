"""Catalog of Educo planning indicators. No beneficiary records or confidential files."""
# (id, code, label, measurement, original, expansion, operational, evidence)
ROWS = [
 ("coverage","SO.1 / A2.3-A2.4","NNA únicos atendidos (protección, PS o educación)","unique",None,1300,None,"Listados codificados depurados"),
 ("education","O2 / A2.3-A2.4","NNA únicos en refuerzo educativo","unique",1500,None,480,"Listados y registro pedagógico"),
 ("psychosocial","O1 / A1.1-A1.2","NNA únicos en apoyo psicosocial","unique",1000,None,360,"Listas codificadas y fichas PS"),
 ("ps_sessions","O1.P4 / A1.1-A1.2","Sesiones psicosociales individuales y grupales (sin duplicar)","event",200,180,60,"Registro de sesiones; meta ampliación por confirmar"),
 ("ps_group","A1.1 / O1.01","Sesiones grupales de apoyo psicosocial","event",None,None,None,"Registro de sesiones"),
 ("pap","A1.2 / O1.01","Atenciones individuales / PAP","event",None,None,None,"Registro agregado de atención"),
 ("violence","A1.3 / O1.02","Talleres de prevención de violencias / crianza","event",None,None,None,"Fichas y asistencia"),
 ("caregivers","A1.3 / O1.02","Madres, padres y cuidadores únicos vinculados","unique",None,1300,120,"Listados depurados"),
 ("women","O1.P5","Mujeres, madres y cuidadoras orientadas en protección","unique",None,120,None,"Listados y fichas de orientación; subconjunto"),
 ("leaders","O1.P6 / O1.03","Líderes y voluntarios que completan formación","unique",None,50,None,"Asistencia y evaluación breve"),
 ("women_leaders","O1.P6","Lideresas fortalecidas (subconjunto de líderes y mujeres)","unique",None,24,None,"Registro y evaluación; seis por comunidad"),
 ("teachers","O2.04","Docentes / facilitadores únicos vinculados","unique",None,70,None,"Listados depurados"),
 ("facilitators","A2.5","Facilitadores comunitarios capacitados","unique",130,None,24,"Listados y evaluación"),
 ("selfcare","A2.5 / O2.04","Docentes / facilitadores en autocuidado","unique",160,None,24,"Registro de formación"),
 ("wash_points","A1.4","Puntos WASH funcionales al cierre","stock",8,None,None,"Lista de cotejo y calidad del agua; sin nuevas instalaciones de ampliación"),
 ("hygiene","A1.5 / O1.P3","Jornadas de promoción de higiene / WASH","event",None,None,60,"Registro de sesiones y lista de cotejo"),
 ("fixed","O1.P1 / A2.1","Espacios de Apoyo fijos habilitados y operativos","stock",None,4,None,"Lista de verificación de funcionamiento"),
 ("mobile","O1.P2","Rutas móviles de atención implementadas","stock",None,None,None,"Planificación y jornadas verificadas; no son equipos independientes"),
 ("eta","A2.1","ETA habilitados y operativos","stock",None,None,None,"Lista de cotejo; evitar duplicar espacios fijos"),
 ("school_kits","A2.2 / O2.P1","Kits escolares y de aprendizaje entregados","event",500,600,None,"Focalización, actas de entrega e inventario"),
 ("menstrual_kits","A2.2 / O2.P2","Kits de higiene menstrual entregados","event",400,350,None,"Diagnóstico de necesidad, actas confidenciales e inventario"),
 ("education_sessions","A2.3 / O2.03","Sesiones de nivelación educativa","event",None,None,60,"Planificación y registro de sesiones"),
 ("sel","A2.4 / O2.03","Actividades de aprendizaje socioemocional","event",None,None,None,"Registro pedagógico"),
 ("protection_routes","A1.2 / SO.1","Espacios con rutas de protección verificadas y activas","stock",None,4,4,"Protocolos y directorios; no sumar verificaciones"),
 ("communities","SO.1","Comunidades priorizadas con intervención verificada","stock",None,4,4,"Ficha territorial y evidencia"),
 ("trips","LOG.01","Traslados logísticos ejecutados","event",48,72,None,"Bitácora y comprobantes"),
 ("field_days","PLAN","Jornadas comunitarias ejecutadas","event",None,None,30,"Agenda y acta de jornada"),
 ("indirect","IRIS","Beneficiarios indirectos (criterio pendiente de validación)","unique",None,None,None,"Caracterización familiar, excluir directos y duplicidades"),
 ("quality","OG-I1","Asistencia pertinente, accesible, oportuna, segura y participativa","rate",80,None,None,"Encuesta de percepción"),
 ("wellbeing","OG-I2","Mejora del bienestar psicosocial de NNA y cuidadores","rate",70,None,None,"Evaluación pre/post"),
 ("continuity","OG-I3","Mejor acceso o continuidad educativa de NNA","rate",75,None,None,"Evaluación y seguimiento educativo"),
 ("case_route","O1","Casos de desprotección con ruta activada y seguimiento","rate",90,None,None,"Registro agregado confidencial"),
 ("risk_knowledge","O1","Capacidad para identificar riesgos y utilizar rutas","rate",70,None,None,"Evaluación de aprendizaje"),
 ("safe_water","O1","Hábitos correctos de higiene y agua segura","rate",75,None,None,"Lista de cotejo y evaluación"),
 ("academic_sel","O2","Avances académicos e integración socioemocional","rate",70,None,None,"Evaluaciones pre/post"),
 ("sio2","OG / SIO 2","NNA consultados que se sienten seguros, respetados y respaldados","rate",None,80,None,"Encuesta de percepción y satisfacción"),
 ("sio1","OG / SIO 1 / O2","NNA con evaluación inicial y final que mejoran al menos una competencia","rate",None,75,None,"Evaluación inicial y final adaptada a edad"),
 ("route_rate","SO.1","Espacios fijos con procedimientos de protección y derivación","rate",None,100,None,"Lista de verificación; denominador 4"),
]
CATALOG = {r[0]:dict(id=r[0],code=r[1],label=r[2],kind=r[3],original=r[4],expansion=r[5],operational=r[6],evidence=r[7]) for r in ROWS}
AGES = ["3-5","6-9","10-13","14-17","18"]
COMMUNITIES = ["Naiguatá","Caraballeda","Caucaguita","Caricuao"]
ACTIVITIES = {
 "original":["A1.1","A1.2","A1.3","A1.4","A1.5","A2.1","A2.2","A2.3","A2.4","A2.5"],
 "expansion":["O1.01","O1.02","O1.03","O2.01","O2.02","O2.03","O2.04","LOG.01","LOG.02","SEG.01","SEG.02"],
}
