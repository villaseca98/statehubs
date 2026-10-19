# Auditoría de consolidación — 19/10/2026

Base: `main` en `ec967d6` (PR #37 y #31 fusionados hoy). Comprobado en este checkout: `npm run build` OK, `npm test` 302/302 OK, `npm run lint` 0 errores (5 avisos ya existentes). No he comprobado el despliegue de Vercel ni he tocado la base de datos real.

Leyenda: ✅ funciona y está conectado · 🟡 parcial o desconectado · 🔴 no existe · 🎭 solo visual o de sesión

## 1. Matriz por área del encargo

| Área | Estado | Evidencia (archivo) | Qué falta |
| --- | --- | --- | --- |
| Tarjeta de inmueble | 🟡 | `PropertyFeed.tsx`: una tarjeta cada vez, galería privada, precio con moneda, pestañas Detalles/Leads/Actividad/Visitas, menú ··· con editar y borrar con confirmación y permiso | No muestra nº de leads, cualificados, próxima visita/reserva, agente ni estado comercial a simple vista. Solo hay vista de una en una (no rejilla). Sin acceso directo a conversaciones, ofertas ni matcher desde la tarjeta |
| Filtros Real Estate / Holiday Rentals | ✅ | `propertyCategory()` lee `operacion` real; Buy/Rent y "sin categoría" | No hay Short/Long Stay (el modelo no tiene ese campo). No se combinan con búsqueda, orden ni vistas guardadas en el feed. `BusinessModeCards` guarda otro "modo" en localStorage que no filtra nada del feed (duplicado) |
| Leads por inmueble | ✅ | `PropertyLeads.tsx` + `propertyContacts()`: cualificados (solo con dato explícito) y potenciales | Sin "nuevos" ni "descartados"; no se ven conversaciones del lead |
| Mini-CRM por inmueble | 🔴 | Hay piezas sueltas (pestañas de la tarjeta + ficha lateral `RecordPanel`) | No existe un espacio único con Overview / Leads / Conversations / Viewings & Bookings / Offers & Deals / Activity |
| Motor de matching | 🟡 duplicado | **Dos motores**: `lib/crm/matching.ts` (determinista, criterios explicables, decisiones persistentes en `crm_match_decisions` con RLS) y `lib/crm/matchIntelligence.ts` (otro cálculo con alias en inglés, usado por `MatchDesk`, `OpportunityUniverse` y la búsqueda ⌘K) | Unificar en uno solo |
| Matcher estilo Tinder | 🎭 | `MatchDesk.tsx`: una pareja cada vez, pero guardar/descartar **solo dura la sesión** (lo dice el propio texto) | Sin swipe, sin persistencia, sin "abrir perfil / contactar / visita" en la misma tarjeta, sin dirección lead → inmuebles |
| Matching bidireccional | ✅ en la ficha | `MatchIntelligence.tsx` en `RecordPanel`: desde inmueble o desde contacto, guarda/descarta en servidor, crea visita | Es una lista larga dentro de la ficha, no la experiencia visual |
| Conversaciones tipo Instagram | 🔴 | Solo la vista "Bandeja de Instagram" (lista de registros `conversacion`), transcripción como texto plano en la ficha | Sin interfaz de 3 columnas, sin burbujas, sin panel de contexto |
| Responder desde StateHubs | 🔴 | `crm-instagram` solo tiene `status/connect/disconnect` y el bot automático | No hay acción "enviar respuesta humana" en servidor. WhatsApp/email: solo enlaces `wa.me`/`mailto` |
| Bot de cualificación Instagram | 🟡 | `_shared/blueprint/bot.ts` (motor puro, 410 líneas de tests), webhook firmado, OAuth | Desplegado, pero sin credenciales de Meta ni revisión de la app: no está conectado de verdad |
| Visitas | ✅ | `cita_inmo` con contacto + inmueble; se crean desde el matcher | Sin estado "solicitada vs confirmada" separado del resultado |
| Reservas turísticas | 🟡 | `reserva` + iCal + timeline con solapes | Sin bloqueo transaccional de solapes (migración candidata en PR #21, sin fusionar) |
| Ofertas y comisiones | 🔴 en main | La entidad `operacion` tiene importe, comisión y etapa "negociación" | **PR #23, #24 y #25 (historial de ofertas, libro de comisiones, reversos) se fusionaron en ramas intermedias, no en `main`**. Su código y migraciones no están en producción |
| Actividad / notas internas | ✅ | `crm_record_events` + `RecordActivity.tsx`, idempotente, con permisos | — |
| Multi-tenant / roles / RLS | ✅ | 12 migraciones, pruebas SQL negativas y verificación real documentada en `SUPABASE_ACTIVATION.md` | Invitaciones por email pendientes |
| Idioma | 🟡 | Inglés por defecto en entrada y tarjetas; catálogos en `src/i18n` | Mucho texto interior aún en español o en inglés fijo sin catálogo; datos de ejemplo en español (Valencia) |
| Identidad visual | 🟡 | Tema actual rojo/rosa (`look.ts`, `theme.ts`) | El encargo pide verde bosque + marfil |
| Paneles de inteligencia | 🟡 duplicado | `OperationsDashboard`, `LivingWorkspace`, `IntelligenceCommandCenter`, `DealMomentumBoard`, `OpportunityUniverse` en un desplegable "Workspace tools" | Solapan entre sí; ninguno es el mini-CRM |
| Despliegue | ❓ | `statehubs.vercel.app` según docs | No verificado en esta auditoría |

## 2. Duplicidades y huecos verificados

1. **Dos motores de matching** con reglas distintas (uno exige moneda, disponibilidad e intención; el otro puntúa con tolerancias propias). Un mismo par puede salir compatible en un sitio y no en otro.
2. **Matcher global de sesión** (`MatchDesk`) frente al persistente de la ficha: lo que guardas en uno no aparece en el otro.
3. **Dos selectores de "modo de negocio"**: el feed (Real Estate / Holiday Rentals) y `BusinessModeCards` en ajustes (localStorage) que no cambia el feed.
4. **Trabajo fusionado fuera de main**: ofertas y comisiones (PR #23–#25). Además siguen abiertos #21 (cimientos de dominio, incluye la guarda de solapes) y #26 (calendario de rentas).
5. **54 ramas remotas**, muchas de "phase1" con nombres casi iguales; no las he tocado.

## 3. Modelo de datos (reutilizable, sin tablas nuevas para lo básico)

Todo vive en `crm_records` (JSON por entidad, con `app_id` y RLS por organización). Equivalencias con los nombres orientativos del encargo:

| Encargo | Ya existe como |
| --- | --- |
| organizations / organization_members | `crm_organizations` / `crm_org_members` |
| properties | registros `inmueble` |
| contacts / lead_qualifications | registros `contacto_inmo` (+ `match_qualified`, `qualification_status`) |
| property_interests | relación `inmueble` en `operacion`, `cita_inmo`, `conversacion` |
| conversations / messages | registros `conversacion` (transcripción en texto) |
| property_matches | `crm_match_decisions` |
| viewings / bookings | `cita_inmo` / `reserva` |
| deals | `operacion` |
| offers / commissions | solo en las ramas de PR #23–#25 |
| activity_events / internal_notes | `crm_record_events` |

## 4. Orden de trabajo que sigo

1. Un solo motor de matching (`matching.ts`), con alias en inglés, y quitar el de sesión.
2. Tarjetas con indicadores reales y acciones discretas; rejilla + vista de detalle.
3. Mini-CRM por inmueble en un panel con pestañas, usando las mismas entidades.
4. Matcher tipo Tinder (swipe + teclado), bidireccional y persistente.
5. Centro de conversaciones de 3 columnas sobre `conversacion`, con canales no conectados marcados como tal.
6. Tema verde bosque y marfil.

Pendiente de decisión del dueño (no lo hago sin permiso): reintegrar en `main` las migraciones de ofertas/comisiones y aplicarlas a la base real; envío de respuestas humanas por la API de Instagram (requiere credenciales de Meta).

## 5. Entregado en `claude/consolidacion-tarjetas-matcher`

| Pieza | Archivos | Verificación |
| --- | --- | --- |
| Un solo motor de matching con alias en inglés; fuera `matchIntelligence.ts` y `MatchDesk` (de sesión) | `lib/crm/matching.ts`, `CommandPalette`, `OpportunityUniverse` | `matching.test.ts`, `matching.global.test.ts` |
| Tarjetas en rejilla con indicadores reales (leads, cualificados, conversaciones, próxima visita/reserva, agente) y acciones con iconos | `PropertyCard.tsx`, `PropertyFeed.tsx`, `lib/crm/propertyHub.ts`, `lib/crm/propertyFormat.ts` | `PropertyFeed.test.tsx`, `propertyHub.test.ts` |
| Filtros Real Estate (All/Buy/Rent) y Holiday Rentals (Short stay) + búsqueda + orden; un único "modo de negocio" | `PropertyFeed.tsx`, `Workspace.tsx` | idem |
| Mini-CRM por inmueble: Resumen, Leads (cualificados/potenciales/nuevos/descartados), Conversaciones, Visitas o Reservas, Ofertas y operaciones, Actividad | `PropertyHub.tsx` | `PropertyHub.test.tsx` |
| Matcher tipo Tinder: swipe, teclado, deshacer, compatible/descartar persistentes, saltar (solo sesión), contacto, visita; desde inmueble y desde contacto | `Matcher.tsx` | `Matcher.test.tsx` (con API local persistente) |
| Bandeja tipo Instagram de 3 columnas sobre `conversacion`, canales no conectados marcados, notas internas | `ConversationCenter.tsx`, `lib/crm/conversations.ts` | `ConversationCenter.test.tsx` |
| Tema verde bosque + marfil en el CRM | `look.ts`, `theme.ts`, `design/tokens.ts` | tests de tema |
| Campos `moneda` (inmueble y contacto) y `match_qualified` (contacto) en el módulo inmobiliario | `modules.ts` | suite completa |

Sin migraciones nuevas. Los workspaces ya creados reciben los campos nuevos solo cuando apliquen la propuesta de su plano. Capturas a 390 y 1440 px de la demo en `/mnt/project-files/statehubs/capturas/consolidacion/`.

Límites honestos: "Saltar por ahora" no se guarda (el servidor solo admite sugerido/guardado/descartado); responder desde la bandeja necesita la conexión oficial del canal; ofertas y comisiones siguen fuera de `main`; la portada y el logo siguen en rojo.
