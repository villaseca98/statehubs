# StateHubs · Fase 09 — Arquitectura SaaS multiagencia (expand)

## Diseño
`crm_organizations` (id, owner_id, name, settings JSONB) agrupa una agencia; `crm_org_members` (org_id, user_id, role) asigna roles `owner/admin/agent/viewer`. `crm_apps.org_id` asocia cada CRM a la agencia y `crm_records.org_id` guarda su organización explícita. La FK compuesta `(app_id,org_id)` impide mezclar un registro de una agencia con la app de otra. Índices por miembro, app, entidad y fecha; un solo owner por agencia. Las configuraciones son JSONB validado como objeto.

## Migración sin pérdida de datos
1. Hacer copia de seguridad y ejecutar en STAGING.
2. Aplicar `supabase/migrations/20261012193000_saas_organizations_expand.sql` **después** de todas las migraciones anteriores. Crea una agencia por owner existente, asigna owner como miembro, rellena `org_id` en apps y registros existentes **sin borrar ni recrear los registros**.
3. Verificar `select count(*) from crm_apps where org_id is null` y `select count(*) from crm_records where org_id is null`; deben ser cero. Comparar recuentos de apps, registros, versiones y mensajes antes/después.
4. Ejecutar `supabase/tests/phase09_tenant_isolation.sql` en staging con dos owners y aplicaciones diferentes; realizar pruebas de RLS con JWTs auténticos de dos agencias (select/insert/update/delete y Storage).
5. Aplicar en producción con backup, mantenimiento y seguimiento de errores. No fusionar una PR equivale a ejecutar la migración: se requiere aplicar el SQL en el proyecto Supabase.

## Autorización y seguridad
- Los miembros pueden leer apps y registros de su agencia. `owner/admin/agent` pueden crear/editar registros; `owner/admin` pueden borrarlos. `viewer` solo lee.
- Solo `owner/admin` pueden cambiar nombre/settings de organización y gestionar miembros mediante RPC. No pueden elevar a otro usuario a `owner`, alterar el owner ni editar `org_id` directamente.
- `crm_owns_app` y los RPC de propuestas/versiones existentes siguen siendo **solo del propietario** para no ampliar privilegios de administración del blueprint antes de auditar los Edge Functions.
- Las políticas de Storage existentes siguen usando `crm_owns_app` (solo propietario). Las conexiones Google/Instagram y otros secretos no cambian.
- No se conceden lecturas sobre versiones/propuestas/mensajes a miembros; la colaboración en el editor y las integraciones necesita una fase de permisos específica.
- Las altas de usuario se realizan para IDs ya existentes en auth.users. Invitaciones por correo, aceptación y transferencia de propiedad quedan pendientes.

## Reversión
`supabase/rollback/20261012193000_saas_organizations_rollback.sql` devuelve RLS owner-only y elimina solo las columnas/tablas **nuevas**. Conserva apps, registros y versiones existentes. Bloquea la reversión si ya hay miembros distintos del owner, porque se perderían las membresías. Backup obligatorio antes de ejecutar. Una reversión no restaura permisos/objetos ajenos a esta migración.

## Limitaciones de esta entrega
- Se mantiene un solo owner por organización, y una organización inicial por owner. La asignación de apps nuevas es automática.
- El cliente incorpora API tipada para consultar organizaciones, miembros y administrar ajustes; **no incluye todavía una pantalla de administración**.
- La FK y triggers previenen reasignación de agencia. Se mantienen columnas `org_id` anulables durante expansión para compatibilidad; imponer NOT NULL en una fase posterior tras verificación.
- Las pruebas SQL de aislamiento son ejecutables en staging pero no corren en GitHub Actions sin PostgreSQL/Supabase y dos cuentas de prueba. El CI actual verifica TypeScript, lint y tests de aplicación, no demuestra aislamiento RLS por sí solo.
