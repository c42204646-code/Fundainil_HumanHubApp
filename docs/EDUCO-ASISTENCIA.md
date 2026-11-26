# Digitalización y asistencia EDUCO

## Flujo
En el servidor de evaluación abrir /educo/asistencia (enlace desde MERA). Captura y revisión usan dos credenciales distintas. La gerencia consulta el padrón restringido de personas y emite un código aleatorio estable HH-XXXXXXXXXXXX solo al confirmar que no existe previamente. El código se conserva para todas las visitas, fases y comunidades. Mantener la correspondencia identidad-código en el padrón protegido autorizado, no en GitHub, ni en las instrucciones de agentes.

El equipo de campo toma una foto desde el móvil o adjunta JPG/PNG/WebP, revisa el texto OCR editable y compara cada fila con la lista original. Para listas nominales sin código, conciliar con el padrón externo; nunca crear un identificador nuevo solo porque el OCR no reconoció uno. Guardar el lote con referencia a la fuente original. Gerencia contrasta la fuente y aprueba o descarta. La aprobación incorpora las asistencias de forma atómica; las pendientes no cuentan.

El mismo código en la misma sesión se cuenta una sola vez. Sesión = comunidad, código estable de espacio, fecha, turno y número dentro del turno. Usar número idéntico para varias fotos de la misma actividad, aunque se carguen por separado. No se permite cambiar la fase o servicio de una sesión existente por otro lote. La asistencia repetida en sesiones distintas se conserva. El alcance por período usa COUNT(DISTINCT code), incluyendo todas las fases en el consolidado integrado sin sumar personas por fase o servicio. Una sesión compartida solo cuenta en el consolidado integrado.

## Instalación para prueba sintética
- Instalar dependencias de requirements.txt y, en Linux Debian/Ubuntu, tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng. La captura no usa OpenAI ni otra API externa. Si falta Tesseract, se admite transcripción manual.
- Configurar HH_MANAGER_USER/PASSWORD y HH_CAPTURE_USER/PASSWORD, con usuarios distintos y contraseñas diferentes de mínimo 20 caracteres.
- HH_ATTENDANCE_ENABLED=1 habilita mutaciones de este módulo. Por defecto 0.
- Usar HTTPS y sesiones separadas de navegador (HTTP Basic de prueba); no compartir credenciales. Verificar reglas de privacidad, acceso y retención antes de datos reales.
- Ejecutar python -m pytest -q y verificar cámara/galería en los teléfonos reales.

## Límites de esta entrega
OCR local no garantiza precisión manuscrita; comparación humana obligatoria. No se guarda la imagen original ni el texto nominal; solo códigos, metadatos y referencia de fuente. El original se custodia por un canal institucional restringido, según protocolo y consentimiento. La foto puede contener datos personales: no usar listas reales hasta revisar privacidad y autorizar la infraestructura. El servidor recibe la imagen transitoriamente; no permitir que proxy o registro de errores archive el cuerpo. No se almacenan nombres, cédulas, biometría ni firmas. No se envían códigos ni fotografías al agente ATLAS.

La exactitud de personas únicas depende del padrón: dos códigos emitidos a una misma persona seguirían contando como dos. Se requiere un responsable de identidad y un procedimiento de conciliación con registros históricos. El sistema tampoco detecta sesiones duplicadas con distinto número o espacio escrito de forma distinta; se debe usar catálogo de espacios y agenda estable. El registro de participantes no sustituye MERA contractual ni deduplicación histórica. El tablero de asistencia se mantiene separado del consolidado MERA: no se suman ambos ni se sobreescriben automáticamente. Se requiere conciliación y mecanismo de corrección de asistencias aprobadas antes de operación definitiva. La separación de dos roles es inicial, no cuentas individuales completas. No se han cargado listas reales ni desplegado a producción.
