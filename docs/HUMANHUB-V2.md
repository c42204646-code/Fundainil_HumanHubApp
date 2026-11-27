# HumanHub 2.0 | entrega inicial de ingeniería

## Auditoría
La rama main contiene cinco archivos de aplicación/documentación, sin servidor. La interfaz de campo guarda registros e informes en localStorage; las claves y roles se comprueban en el navegador. Los borradores gerenciales anteriores afirmaban resultados sin consultar datos; el envío a Dirección solo guardaba localmente. No se verificó un despliegue real ni una base de datos externa.

## Cambios
- Se conserva la interfaz legado con advertencia explícita: no usar para datos personales ni protección.
- Exportación de datos demográficos agregados sin fotos, GPS, testimonios ni nombres; confirmar proyecto y validar datos antes de importar.
- Servidor FastAPI independiente con SQLite persistente, autenticación gerencial HTTP Basic, validación de entradas, conciliación de desagregados, importaciones idempotentes y registro de eventos.
- ATLAS analiza agregados por proyecto y período; NEXUS usa búsqueda web real a través de OpenAI Responses API. Sin credenciales, no simula resultados. Los textos requieren revisión humana.
- Word y PDF generados en servidor; Excel de indicadores ATLAS. Envío real por SMTP TLS con Word/PDF, autorización explícita y lista de destinatarios. No reintentar estados delivery_unknown/sending sin consultar al proveedor.
- Centro de inteligencia protegido por servidor; no publicar este módulo como simple sitio estático.

## Arranque local de evaluación (solo datos sintéticos)
Python 3.11 o 3.12:
1. python -m venv .venv
2. Activar el entorno e instalar: pip install -r requirements.txt
3. Copiar .env.example a .env (ignorado por git). Configurar usuario y contraseña única de mínimo 20 caracteres. Para IA configurar OPENAI_API_KEY y HH_MODEL con modelo habilitado para Responses y búsqueda web. Para correo configurar SMTP SSL y una lista de direcciones autorizadas separadas por comas.
4. Instalar python-dotenv (o exportar variables al entorno); ejecutar uvicorn server.main:app --host 127.0.0.1 --port 8000 --env-file .env
5. Abrir http://127.0.0.1:8000/ e ingresar credenciales.
6. Para el legado servir los archivos estáticos por separado, exportar agregados y revisarlos antes de importar.
7. Ejecutar python -m pytest -q.

## Límites y requisitos antes de producción
- Esta entrega no migra automáticamente localStorage, no incluye SSO ni permisos individuales por proyecto, ni sincronización de campo ni deduplicación de personas. SQLite es central para una instancia, no una arquitectura multiinstancia. No es todavía un ERP completo.
- No importar expedientes, quejas, ubicaciones exactas ni datos de salud. Evitar grupos pequeños identificables; revisar manualmente anonimización y consentimiento. No incluir datos privados en instrucciones. Las notas libres no se validan semánticamente.
- El legado conserva claves de demostración y renderizados HTML que requieren reemplazo antes de cualquier uso real. Rotar cualquier clave reutilizada; mantener repositorio privado si corresponde. No confiar en permisos del navegador.
- Usar HTTPS obligatorio, proxy con límites de peticiones, autenticación individual (OIDC), RBAC, copias cifradas y políticas de retención. Configurar permisos del volumen de datos y revisar con responsable de protección. No exponer el legado a Internet con datos reales.
- El trabajo con IA es síncrono, puede tardar; faltan cola durable, planificación y reintentos seguros. No se habilita envío automático ni envío externo sin aprobación. La aceptación SMTP no prueba entrega final.
- Faltan plantillas específicas de donantes, gráficos institucionales, indicadores contractuales, presupuestos, Word avanzado y PowerPoint. Verificar narrativa, citas y archivos antes de remitir.
- No se han efectuado llamadas reales a IA ni SMTP desde esta entrega. CI y pruebas de integración deben pasar antes de fusionar.
