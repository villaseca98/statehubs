# StateHubs — Auditoría inicial de arquitectura, producto y seguridad (Fase 01)

Fecha: 2026-10-12. Alcance: revisión estática del repositorio `main` en GitHub. **No se han ejecutado npm build, lint, tests, Deno tests, pruebas E2E, auditoría de dependencias ni validación del dominio/Vercel en vivo.** No se ha inspeccionado el estado real de la base Supabase ni secretos configurados. Las observaciones se refieren al código, no a garantías de producción.

## Inventario verificado por código
- React 18, Vite 5, TypeScript, Tailwind 3, Framer Motion, React Router 6, Supabase JS. Scripts: `npm run build`, `npm run lint`, `npm test`.
- Rutas: `/` landing, `/demo` demo en memoria, `/entrar` login, `/app/:appId` aplicación, `/reels` y `/reels/:reelKey`.
- El modo invitado usa `localStorage` mediante `localCrmApi`; la demo `/demo` usa estado React en memoria. Ninguno es una base de datos SaaS.
- Existe modelo SQL `crm_apps`, versiones, propuestas, mensajes y registros, con RLS por propietario y funciones SECURITY DEFINER. Hay migraciones para Google, Instagram y Meta. **No equivale a un modelo de equipos multiempresa**.
- Existen Edge Functions `crm-agent`, `crm-automate`, `crm-google`, `crm-ical`, `crm-instagram` y `instagram-lead-webhook`. No se ha confirmado despliegue ni permisos externos.
- Integración Instagram: existen rutas de OAuth, webhooks y bot; `crm-instagram` describe respuestas automáticas, por lo que requiere revisión explícita de consentimiento, configuración, ventana de mensajería y uso real.
- Vercel: `vercel.json` configura rewrite SPA; no se ha validado despliegue actual, variables de entorno ni cabeceras de seguridad.
- Hay pruebas Vitest para páginas, vistas, calendarios, automatizaciones, Instagram y blueprints; su resultado es desconocido.

## Hallazgos priorizados
| Prioridad | Hallazgo y evidencia | Acción / condición de cierre |
|---|---|---|
| P0 | Modelo de propiedad individual en `20261010120000_crm_builder.sql`; no hay organizaciones, membresías y RBAC multiagencia completo. | Implementar tenancy y pruebas negativas RLS antes de usar datos de varias agencias. |
| P0 | La configuración efectiva de RLS, storage, secretos y funciones en Supabase producción no es visible desde GitHub. | Verificar con entorno staging y pruebas de autorización reales. |
| P1 | `Landing.tsx` convertía silenciosamente fallos de creación remota en apps locales incluso con sesión. Riesgo de falsa expectativa de persistencia. | Corregido en esta PR: los errores del servidor no se sustituyen por guardado local. |
| P1 | Integraciones externas requieren configuración, credenciales y autorización de cada proveedor; no consta prueba E2E de captación/reserva real. | Añadir matriz de capacidades y pruebas staging. |
| P1 | Función `crm-instagram` automatiza respuestas en su implementación; comprobar consentimiento, reglas Meta y seguridad de automatización. | Revisar política y pruebas con cuentas de test. |
| P1 | No consta CI obligatorio, comprobación E2E, backup/restauración ni facturación multiagencia en el árbol inspeccionado. | Implementar gates de calidad, recovery y billing antes de comercializar. |
| P2 | La ruta desconocida redirigía al inicio. | Corregido con pantalla 404 accesible y navegación. |
| P2 | Demo mostraba marca antigua Aurora. | Corregido a StateHubs. |
| P2 | `Login.tsx` aceptaba next con // y backslash. | Endurecido para impedir destinos protocol-relative. |
| P2 | UX responsive, contrastes, tamaño de bundles y Core Web Vitals no medidos. | Lighthouse, axe y pruebas en Safari/iOS/Android reales. |

## Correcciones incluidas en esta PR
1. El usuario autenticado no caerá silenciosamente en `localStorage` cuando falle Supabase al crear una app.
2. Se explicita el alcance del modo invitado en la landing.
3. La demo se identifica como StateHubs.
4. Ruta 404 específica con enlaces a portada y demo.
5. Validación más estricta de la ruta `next` en login.

## Verificación requerida antes de merge
- `npm ci && npm run build && npm run lint && npm test`.
- Probar rutas `/`, `/demo`, `/entrar`, `/app/:appId`, `/ruta-inexistente` en escritorio y móvil.
- Usuario autenticado con servidor inaccesible: mostrar error y no crear app local; invitado: creación local permitida.
- Probar `/entrar?next=//example.com` y `/entrar?next=%5C%5Cexample.com`.
- Revisar preview Vercel y contraste/foco/teclado.

**No fusionar hasta ejecutar estas comprobaciones.** Las migraciones multiempresa y cambios sensibles de RLS se harán en una fase separada con staging y plan de reversión.
