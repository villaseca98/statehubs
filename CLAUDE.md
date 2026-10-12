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
