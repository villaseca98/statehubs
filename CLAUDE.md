# StateHubs — CLAUDE.md

Constructor de CRM y ERP para pymes y autónomos en España. Español de España en toda la interfaz, claro y sin tecnicismos.

## Ideas que no se negocian

- **Un CRM que dice qué toca hoy.** La app abre en «Hoy» (`lib/crm/today.ts`). Todo lo nuevo debe alimentar o respetar esa pantalla: fechas útiles (cita, vence, límite, entrega, caduca) y estados con un final claro.
- **Limpio.** Una sección cada vez, ficha en panel lateral, herramientas (Piezas, IA, Historial) abajo en el menú. El 3D es solo para presentar StateHubs (portada y reels), nunca dentro de la app del cliente. No volver a meter todo en una página ni catálogos de estilos: hay un solo diseño (`_shared/blueprint/look.ts`).
- **La IA solo escribe el plano** (JSON: entidades, campos, vistas). Nunca código.
- **Propuesta antes de aplicar, siempre con vuelta atrás.** Cada aplicación crea una versión; deshacer crea otra. Nunca se reescribe el historial.
- **Nunca cambies la `key` de algo existente** en un plano: los datos dependen de ella. Quitar un campo o una pieza lo oculta, no lo borra.
- **Modo prueba y servidor con la misma interfaz** (`localApi.ts` imita a `api.ts`). Lo que funcione en uno debe funcionar en el otro.

- **Una marca.** El logo es «Capas de estado» (`components/brand/Logo.tsx`, colores en `BRAND` de `look.ts`). Cada app lleva ese logo por defecto; su dueño puede subir el suyo en Piezas (`bp.logo`, PNG pequeño, llega como propuesta).

## Cómo trabajar

- Lee el archivo entero antes de tocarlo y sigue su estilo.
- Antes de dar algo por terminado: `npm run build`, `npm test` y `npm run lint` sin errores.
- Cambios visibles: míralos en móvil (390 px) y escritorio.
- Los estilos de texto y colores van por variables CSS (`--crm-*` en la app, tokens de Tailwind en el resto).

## Inmobiliarias y alquiler turístico

StateHubs es solo para inmobiliarias y alquiler turístico, y es **una sola app**: compraventa, alquiler y pisos turísticos comparten contactos, inmuebles y equipo.

- **Entrada:** la portada pregunta compraventa, alquiler turístico o las dos (`PACKS` y `composePack` en `modules.ts`). No vuelvas a ofrecer «CRM o ERP» ni sectores genéricos en la portada; las piezas genéricas siguen en Piezas → «Más piezas».
- **Modelo:** `contacto_inmo` (temperatura y próxima acción), `operacion` (embudos de compradores, vendedores, captación y alquileres), `inmueble` (venta, alquiler y turístico, con licencia y calendarios iCal), `cita_inmo`, `reserva`, `servicio` (limpiezas y check-in) e `incidencia`. El neto de una reserva (importe − comisión − gastos) se calcula, no se guarda.
- **Vistas propias:** `ops` (centro de operaciones), `timeline` (reservas por alojamiento, marca solapes) y `cards` (fichas con foto).
- **Airbnb y Booking:** las reservas entran por el iCal de cada anuncio. No prometas sincronizar precios, mensajes ni pagos: las API de las plataformas piden ser partner o pasar por un channel manager.
- **Datos de ejemplo:** siempre marcados (`is_sample`) y se quitan con un botón.

## Análisis y sectores

- **Análisis de datos** (pieza `analisis`, vista `analysis`, motor en `_shared/blueprint/analysis.ts`, sin IA): embudo y previsión, leads puntuados con su porqué y los que se enfrían, casuísticas y base de datos con huecos, duplicados y CSV. Qué enfoques, qué secciones y los días para darlo por frío se eligen en Piezas y llegan como propuesta.
- **Sectores** (`_shared/blueprint/sectors.ts`): ventas, inmobiliaria, almacén y control de BBDD. Cada uno trae sus piezas y campos extra, que se aplican también a las piezas que se pongan después. Se eligen al empezar, en la Landing.

## Instagram (leads por la noche)

- **Pieza `instagram`** («Leads de Instagram», en los tres packs): entidad `conversacion` (estado en_curso → cualificado → agendado/reservado, o humano/descartado; transcripción y resumen) y la vista «Bandeja de Instagram». La tarjeta «Esta noche por Instagram» del centro de operaciones sale de `nightInstagram()` en `lib/crm/ops.ts`.
- **El asistente es el plano** (`bp.bot`, tipos en `types.ts`, validado en `validate.ts`, legible en `diff.ts`): palabras clave, preguntas que guardan en `conversacion` o `contacto_inmo`, reglas de puntuación, umbrales y final (cita en la Agenda, prerreserva «Por confirmar» o «te llamamos»). Se edita en la herramienta «Instagram» (`InstagramSetup.tsx`, `BotEditor.tsx`) y llega como propuesta. La IA no lo toca: `agent.ts` conserva el `bot` actual.
- **Un solo motor** (`_shared/blueprint/bot.ts`, sin IA y puro): lo usan el simulador (`InstagramSimulator.tsx`, también en la demo) y el servidor. Su estado va en `conversacion.data._bot`. Nunca cobra ni confirma una reserva; si piden una persona o dicen que no, se calla y lo deja en la bandeja.
- **Servidor:** `crm-instagram` (OAuth de Instagram, webhook firmado con `X-Hub-Signature-256`, respuesta privada a comentarios, Send API dentro de la ventana de 24 h, cada evento una sola vez). Tokens en `crm_instagram_accounts` y eventos en `crm_instagram_events` (RLS sin políticas: solo el servidor). Helpers en `_shared/instagram.ts`.
- **Poner en marcha con Meta (una vez, para todos los clientes):**
  1. developers.facebook.com → crear app de tipo «Empresa» → añadir el producto Instagram → «API con inicio de sesión de Instagram».
  2. Permisos: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`.
  3. Inicio de sesión: URI de redirección OAuth `https://<proyecto>.supabase.co/functions/v1/crm-instagram`.
  4. Webhooks: URL de devolución la misma, token de verificación = `INSTAGRAM_VERIFY_TOKEN`; suscribirse a `comments` y `messages`.
  5. Secretos de Supabase: `INSTAGRAM_APP_ID` y `INSTAGRAM_APP_SECRET` (los de Instagram, no los de Facebook), `INSTAGRAM_VERIFY_TOKEN` y `INSTAGRAM_STATE_SECRET` (aleatorios largos). Aplicar la migración y desplegar con `supabase functions deploy crm-instagram --no-verify-jwt`.
  6. Hasta pasar la revisión de la app (y la verificación del negocio) solo funciona con cuentas con rol en la app (probadores). Cada cliente necesita cuenta de Instagram profesional (empresa o creador) y activar «Permitir acceso a mensajes» en Ajustes → Mensajes.

## Funciones del servidor (`supabase/functions`)

- `crm-agent`: la IA y las piezas proponen cambios al plano. `crm-automate`: envía registros a los webhooks de «Automatizaciones».
- `crm-ical`: lee el enlace iCal de Airbnb/Booking de cada inmueble (`ical_airbnb`, `ical_booking`; solo https públicas, sin redirecciones) y crea, mueve o cancela reservas por `ref_externa` = UID (`origen_sync` «ical»). Solo fechas: ni precios ni mensajes. Parser en `_shared/blueprint/ical.ts`; en modo prueba dice que necesita cuenta.
- `crm-google`: conecta el Google Calendar de cada persona (OAuth). Acciones `status`, `start`, `finish`, `disconnect`, `busy` (horas ocupadas → tachadas al agendar) y `push` (crea, mueve o quita el evento del registro en su calendario principal; el id del evento sale del registro, así que repetir es actualizar). Agendar o mover una cita (campo `datetime`) la manda sola; las reservas y lo demás, con el botón de la ficha. Sin cuenta, y siempre, cada ficha con fecha tiene «Añadir a Google Calendar» y «Descargar .ics» (`_shared/blueprint/calendar.ts`). Tokens en `crm_google_accounts` (RLS sin políticas: solo la función los lee). Si faltan secretos, la UI dice «Falta configurar Google en el servidor» y no ofrece conectar.
  - **Secretos** (Supabase → Edge Functions → Secrets): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_STATE_SECRET` (aleatorio, 32+ caracteres: `openssl rand -hex 32`) y `APP_URL` (origen de la app, p. ej. `https://statehubs.app`; varios separados por comas). Solo se vuelve a `APP_URL/app/<id>`.
  - **Google Cloud:** activar «Google Calendar API»; pantalla de consentimiento con los permisos `calendar.events`, `calendar.freebusy`, `openid` y `email`; credencial «ID de cliente de OAuth» de tipo «Aplicación web» con **URI de redireccionamiento autorizado** `https://<ref>.supabase.co/functions/v1/crm-google` (otra URL: ponla también en el secreto `GOOGLE_REDIRECT_URI`).
  - **Desplegar** con `supabase functions deploy crm-google --no-verify-jwt` (Google vuelve sin sesión de Supabase; la función comprueba el JWT en cada POST) y aplicar la migración `20261012120000_crm_google.sql`.
- `crm-instagram`: el asistente de Instagram (ver «Instagram»). Se despliega con `--no-verify-jwt`.
