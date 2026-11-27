# HumanHub Sandbox en Vercel
Esta configuración es una previsualización estática aislada: utiliza las interfaces reales de Gerencia, MERA y Scan y el catálogo actual, pero ninguna API de producción. No persiste datos, no importa imágenes, no ejecuta OCR ni IA ni remite correos. No introducir información personal. El servidor FastAPI sigue separado.

## Importación
Crear un proyecto independiente en Vercel desde el repositorio c42204646-code/Fundainil_HumanHubApp. Configurar la rama develop/humanhub-v2 como rama de producción DEL SANDBOX (no main), raíz del repositorio, Framework Preset Other, Build Command node scripts/build-sandbox.mjs, Output Directory sandbox-dist. La configuración vercel.json declara estos valores. Si el asistente inicial intenta desplegar main, no usar esa URL: configurar la rama de desarrollo y crear un nuevo despliegue de esa rama. No conectar variables de entorno ni bases de datos reales. Activar Deployment Protection según disponibilidad del plan. Vercel puede asignar un nombre distinto al proyecto; usar la URL que muestre el dashboard.

## Verificación local
node scripts/build-sandbox.mjs
El resultado debe contener solo archivos HTML/JS/CSS. Las rutas /educo y /educo/asistencia se resuelven con rewrites de Vercel. El adaptador local intercepta solicitudes y bloquea escritura y conexiones externas. Para la vista real, se requerirá un servidor FastAPI con almacenamiento persistente y controles individuales.

## Producción
No usar esta configuración de demostración para desplegar el ERP real. No fusionar en main sin revisar su configuración de despliegue. El Sandbox no es un piloto con datos reales; no acredita funcionamiento de servicios externos.
