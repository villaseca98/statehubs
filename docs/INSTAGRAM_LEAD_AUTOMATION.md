# StateHubs — entrada automática de leads desde Instagram / Meta

**Estado:** primera integración de piloto implementada en código para formularios instantáneos de Meta Lead Ads. No está conectada a una cuenta real hasta configurar la aplicación de Meta, los secretos de Supabase, ejecutar la migración y desplegar la función.

## Qué automatiza esta primera versión

1. Meta envía un evento leadgen cuando alguien envía un formulario instantáneo de una campaña.
2. El webhook verifica la firma HMAC de Meta antes de procesar el evento.
3. Recupera los campos del formulario mediante Graph API con un token guardado como secreto de servidor.
4. Normaliza nombre, teléfono, email, operación buscada, presupuesto, zona, plazo, financiación y permiso de contacto cuando esos campos existen.
5. Calcula una puntuación explicable (0–100) y etiqueta el lead como cualificado o pendiente de datos.
6. Inserta el lead en la plantilla inmobiliaria con origen, campaña, IDs de referencia, siguiente paso y prioridad.
7. Una clave única evita importar dos veces el mismo lead en la misma aplicación si Meta reintenta el webhook.
8. No envía mensajes ni llama automáticamente a la persona. La cualificación nunca se interpreta como consentimiento de contacto.

### Instagram frente a Meta Ads

Los formularios instantáneos de Meta pueden aparecer en Instagram o Facebook. El evento leadgen no basta por sí solo para demostrar la ubicación publicitaria. Por eso el origen predeterminado es **Meta Ads (Instagram/Facebook)**. Configura META_LEAD_SOURCE=instagram únicamente cuando el formulario/campaña conectado esté limitado a Instagram y lo hayas verificado.

Los mensajes directos (DM) de Instagram también tienen una primera ruta de captura: el webhook acepta eventos de Instagram Messaging, filtra mensajes de texto entrantes con señales de intención inmobiliaria, evita ecos enviados por la propia cuenta y guarda el mensaje como lead pendiente de revisión/cualificación. No responde automáticamente al usuario ni extrae un nombre real del identificador del remitente. Requiere activar por separado Instagram Messaging API, permisos y suscripciones de webhook. No se debe hacer scraping de la bandeja ni automatizar mensajes masivos no solicitados.

## Secretos requeridos

En el proyecto Supabase de pruebas, configura:

- META_VERIFY_TOKEN: cadena aleatoria que tú eliges para verificar el webhook.
- META_APP_SECRET: secreto de la aplicación Meta, para validar X-Hub-Signature-256.
- META_ACCESS_TOKEN: token de página con los permisos de Meta necesarios para recuperar leads.
- META_PAGE_ID: ID de la página vinculada a la cuenta profesional de Instagram y al formulario.
- META_GRAPH_VERSION: versión Graph API habilitada en tu app Meta.
- META_LEAD_SOURCE: meta_ads por defecto; usa instagram solo para una campaña/formulario verificados como exclusivos de Instagram.
- INSTAGRAM_CRM_APP_ID: UUID de la aplicación StateHubs inmobiliaria que recibirá los leads.
- INSTAGRAM_ACCOUNT_ID: ID de la cuenta profesional de Instagram, necesario para recibir DMs.
- SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: secretos del servidor de Supabase. La service-role key nunca debe ir al navegador, al repositorio ni a una variable VITE_*.

Ejemplo (usa tus propios valores y no los compartas en el repositorio):

~~~sh
supabase secrets set META_VERIFY_TOKEN="valor-aleatorio"
supabase secrets set META_APP_SECRET="secreto-de-meta"
supabase secrets set META_ACCESS_TOKEN="token-de-pagina"
supabase secrets set META_PAGE_ID="id-de-pagina"
supabase secrets set META_GRAPH_VERSION="vXX.X"
supabase secrets set META_LEAD_SOURCE="meta_ads"
supabase secrets set INSTAGRAM_CRM_APP_ID="uuid-de-la-app-inmobiliaria"
~~~

Los secretos del proyecto no deben guardarse en archivos .env versionados. La versión Graph API debe ser una versión soportada por tu aplicación de Meta; no copies literalmente vXX.X.

## Despliegue en staging

1. Crear una aplicación Meta y conectar la página/cuenta profesional correcta.
2. Solicitar los permisos de webhook y recuperación de leads que Meta exija para la configuración y pasar la revisión de aplicación si aplica.
3. Ejecutar la migración 20261012161000_meta_lead_ingestion.sql en una base de staging (por ejemplo, con supabase db push desde el entorno correcto).
4. Configurar los secretos anteriores con supabase secrets set.
5. Desplegar la función con supabase functions deploy instagram-lead-webhook --no-verify-jwt para que Meta pueda llamarla; la función valida la firma HMAC antes de procesar cualquier POST.
6. Configurar en Meta el callback https://<PROJECT_REF>.supabase.co/functions/v1/instagram-lead-webhook, el mismo META_VERIFY_TOKEN y la suscripción a leadgen.
7. Enviar un lead de prueba desde el formulario de Meta y confirmar que aparece una única vez en el CRM.
8. Para DMs, suscribir también la cuenta profesional a los eventos de mensajes requeridos por Instagram Messaging API y configurar INSTAGRAM_ACCOUNT_ID.
9. Enviar desde una cuenta de prueba un mensaje con intención inmobiliaria (por ejemplo, que busca comprar un piso) y confirmar que aparece en la cola con la puntuación y los datos extraídos; un mensaje sin intención debe ignorarse.
10. Repetir ambos eventos y confirmar que no crean duplicados; enviar una firma inválida y comprobar que devuelve 401.
11. Confirmar que no se produce contacto comercial automático si el permiso está pendiente o es negativo.

## Campos recomendados en el formulario

Para que la puntuación sea útil, el formulario debe preguntar solo lo que el equipo realmente necesite:
- ¿Quieres comprar, alquilar, vender o alquilar tu propiedad?
- Zona o municipio de interés.
- Presupuesto o rango de precio.
- ¿Cuándo te gustaría realizar la operación?
- ¿Tienes financiación preaprobada / está en trámite / aún no la has mirado?
- Nombre y un canal de contacto.
- Información clara sobre quién contactará, para qué y cómo ejercer los derechos aplicables.

Los nombres de los campos de Meta deben corresponder a los alias que admite el webhook o se deben ampliar explícitamente. No recopilar datos sensibles ni guardar la carga completa del webhook si no hace falta.

## Puntuación inicial

- Intención: 25 puntos.
- Presupuesto: 20 puntos.
- Zona: 15 puntos.
- Plazo: hasta 15 puntos.
- Situación de financiación: hasta 15 puntos.
- Teléfono o email: 10 puntos.

La puntuación es una ayuda de priorización, no una predicción de venta. Si falta información, el lead se conserva con estado pendiente de datos. El permiso de contacto se evalúa aparte y no añade puntos.

## Límite de arquitectura para el piloto

El webhook actual usa un único INSTAGRAM_CRM_APP_ID y un token de Meta configurado en secretos del servidor: sirve para validar el flujo con una agencia piloto, pero **no es todavía una integración multiagencia comercializable**. Antes de incorporar varias inmobiliarias hay que construir una configuración de conexión por organización, proteger tokens por agencia, gestionar revocación/rotación y validar el aislamiento con RLS. La configuración de tokens por agencia debe hacerse en servidor y no mediante formularios que los guarden en texto plano.

## Siguiente fase: cualificación conversacional

- Añadir un flujo opcional de preguntas y respuestas mediante Instagram Messaging API, limitado a mensajes iniciados por el usuario y a las ventanas/políticas de Meta.
- Pedir solo los datos que falten (operación, zona, presupuesto y plazo) y permitir que el agente intervenga.
- Mantener la puntuación explicable y no marcar una oportunidad como cualificada si no hay datos suficientes.
- No enviar promociones masivas ni iniciar DMs no solicitados.
