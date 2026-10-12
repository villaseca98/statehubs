# StateHubs — Plan de producto y lanzamiento SaaS inmobiliario

Estado: PLAN DE IMPLEMENTACIÓN. Este documento no acredita que las funciones estén implementadas o verificadas.
Marca única: **StateHubs**. No utilizar Aurora en textos, demos ni onboarding.

## 0. Criterio de salida
No admitir clientes reales ni cobrar hasta que: pruebas de aislamiento multiempresa y permisos pasen; se pruebe alta/pago/cancelación; backups/restauración; protección RGPD; despliegue estable y pruebas E2E. Una demo local NO equivale a un SaaS multiempresa.

## 1. Identidad y web pública
- [ ] Unificar StateHubs en título, favicon, logo, correos, demo, textos, metadatos y Open Graph.
- [ ] Diseño premium: tipografía consistente, verde bosque/marfil, capturas REALES del producto, navegación clara y CTAs a demo y alta.
- [ ] Landing: problema → demostración visual → beneficios comprobables → integraciones reales → planes → FAQ → contacto.
- [ ] Evitar prometer un bot de Instagram, reservas automáticas o integraciones que no estén verificadas.
- [ ] Auditoría móvil 320/375/390/768px, tablet y escritorio; accesibilidad WCAG 2.2 AA.

## 2. Modelo de datos multiagencia (Supabase/Postgres)
La base actual usa crm_apps.owner_id y crm_records con datos JSONB. NO equivale a aislamiento multiagencia con equipos.
Diseñar migraciones incrementales y reversibles, sin borrar crm_apps ni crm_records:
- organizations(id, slug, name, status, created_at)
- organization_members(organization_id, user_id, role [owner/admin/agent/viewer], status, invited_by)
- organization_invites(id, organization_id, email, role, token_hash, expires_at, accepted_at)
- organization_subscriptions(organization_id, provider_customer_id, provider_subscription_id, plan, status, seats, period_end)
- organization_settings(organization_id, timezone, currency, locale, branding_json)
- integration_connections(id, organization_id, provider, external_account_id, secret_reference, status, last_sync_at)
- integration_events(id, organization_id, provider, external_event_id, event_type, received_at, processed_at, status, error_code); UNIQUE(provider, external_event_id, organization_id)
- automation_rules(id, organization_id, trigger, conditions_json, actions_json, enabled)
- automation_jobs(id, organization_id, rule_id, idempotency_key, scheduled_at, attempts, status, last_error); UNIQUE(organization_id, idempotency_key)
- audit_events(id, organization_id, actor_user_id, action, target_type, target_id, occurred_at, metadata_json)
- property listings, contacts, leads, opportunities, visits, bookings and messages must be scoped by organization_id; maintain a migration mapping from existing app_id to organization_id.
Use FKs, unique indexes, created_at/updated_at, soft-delete or retention policies where necessary. Avoid duplicating PII in logs.

Security gate: RLS per organization and member role on every table, storage bucket and RPC; explicit SECURITY DEFINER review, restricted EXECUTE grants, cross-tenant negative tests (agency A cannot read/write agency B), no service-role key in browser, no direct client writes to subscriptions/roles. Verify invite tokens expire and are hashed.

## 3. Customer provisioning / replication
1. Agency signs up and verifies email.
2. Server creates organization + owner membership atomically (idempotent).
3. User selects sales, holiday rentals or both.
4. Server provisions default workspace from versioned template; creates settings, pipelines and sample data explicitly tagged is_sample.
5. Agency invites agents (role-based); invite expires and is single-use.
6. Onboarding wizard: branding, first property, first lead, calendar, integrations (only available providers).
7. Trial/paid subscription and seat limits enforced on SERVER, never only in UI.
8. Stripe Checkout + signed webhook: handle duplicate/out-of-order events, cancellation, grace period, invoices and failed payment.
9. Export agency data; revoke integrations, retention and deletion workflow on cancellation.
10. Tests: concurrent signups, duplicate webhooks, expired invites, unpaid accounts, team role changes, downgrade.

## 4. Automations (opt-in and auditable)
- New lead (Instagram/Meta/forms): verify signature, normalize, deduplicate, assign agent, score with explainable rules, notify; avoid sending without consent.
- No first response within SLA: reminder/escalation.
- New visit: calendar invite with explicit confirmation and timezone.
- Visit completed: follow-up task; never invent booking or property availability.
- Holiday booking: iCal import with UID dedup and conflict warnings; iCal does not sync pricing or payments.
- No activity after N days: owner-configurable follow-up.
- Contract renewal / document expiry: reminders.
- Integration errors: retry with exponential backoff + dead-letter queue + admin alert.
Each rule requires audit log, idempotency key, rate limit, opt-out, manual override and test mode. Use scheduled worker/queue; n8n optional, not the source of truth.

## 5. Portal integrations
Idealista/Fotocasa: investigate authorized publication/feed/API contracts per agency before promising two-way sync.
Booking/Airbnb: start with permitted iCal availability import; channel-manager/API partner for richer functions. Track sync direction, freshness and last error visibly.
Instagram/Meta: app review, permissions, webhook verification and per-agency tokens/consent. Never use a single agency's credentials for all tenants.

## 6. Release checklist (20 puntos del vídeo + producción)
- [ ] 01 Política de privacidad RGPD: responsable, finalidad, base legal, derechos, retención, proveedores.
- [ ] 02 Aviso legal y términos/condiciones SaaS; DPA/encargado del tratamiento.
- [ ] 03 APIs y secretos solo en servidor, rotación y escaneo de repositorio.
- [ ] 04 HTTPS, HSTS y redirección HTTP.
- [ ] 05 Cookies: consentimiento previo para no esenciales, rechazar igual de fácil, registro de preferencias.
- [ ] 06 Title, meta description, canonical y OG por página.
- [ ] 07 Vista previa al compartir enlace (OG image).
- [ ] 08 Favicon, app icons y manifest si procede.
- [ ] 09 Sitemap y robots.txt; excluir app privada del índice.
- [ ] 10 Imágenes ALT significativas o vacías si decorativas.
- [ ] 11 Imágenes optimizadas WebP/AVIF, tamaños responsivos, lazy load.
- [ ] 12 Lighthouse/LCP/CLS/INP y pruebas con conexión lenta.
- [ ] 13 Contraste WCAG AA, foco visible y teclado.
- [ ] 14 Móvil: responsive real, formularios, menús y tablas.
- [ ] 15 Página 404 y rutas privadas correctas.
- [ ] 16 Enlaces internos/externos y redirecciones sin roturas.
- [ ] 17 Formularios: validación cliente+servidor, mensajes claros y estados de error.
- [ ] 18 Antispam: rate limits, honeypot/Turnstile según riesgo, protección de endpoints.
- [ ] 19 Analytics GA4 SOLO tras consentimiento cuando aplique; eventos sin PII.
- [ ] 20 CTA principal claro y probado de extremo a extremo.
- [ ] 21 Auth, MFA opcional, recuperación, cierre de sesión, sesiones y CSRF/XSS.
- [ ] 22 RLS multiempresa y RBAC con pruebas negativas.
- [ ] 23 Backups automáticos y simulacro de restauración.
- [ ] 24 Monitorización de errores, alertas, uptime y logs sin PII.
- [ ] 25 CI: lint, typecheck, unit, integration, E2E y build bloqueantes.
- [ ] 26 Cabeceras CSP, nosniff, referrer-policy y permissions-policy.
- [ ] 27 Dependencias auditadas, SBOM y actualizaciones.
- [ ] 28 Email transaccional, SPF/DKIM/DMARC y entregabilidad.
- [ ] 29 Cobros: webhook firmado, facturas, cancelación y reintentos.
- [ ] 30 A11y, navegadores Safari/Chrome/Firefox y pruebas iOS/Android.
- [ ] 31 SEO: schema.org apropiado y sin indexar datos privados.
- [ ] 32 Prueba de onboarding desde cuenta limpia sin ayuda humana.
- [ ] 33 Prueba de exportación/borrado de datos y caducidad de tokens.
- [ ] 34 Auditoría OWASP ASVS L2 proporcional al riesgo.
- [ ] 35 Verificar que producción apunta a main, commit correcto, dominio, SSL y rollback.

## 7. Orden de ejecución
P0: auditoría del estado real, arreglar build/tests y corregir promesas/branding de landing.
P1: multiempresa + RLS + invitaciones + onboarding; pruebas negativas antes de producción.
P2: billing Stripe y provisioning idempotente; automatizaciones internas y logs.
P3: integraciones autorizadas, observabilidad, QA completo y beta con agencia piloto.
P4: lanzamiento comercial después de criterios de salida.

Cada checkbox solo se marca con evidencia (PR, test, captura o resultado de auditoría). No marcar por haber escrito este documento.
