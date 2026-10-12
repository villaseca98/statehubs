# StateHubs — Fase 10: RLS, funciones elevadas y almacenamiento privado

## Dependencia y alcance
Esta PR se basa en la rama de la PR **#12 (Fase 09)**. No debe fusionarse a `main` por separado: la migración 10 necesita la 09 aplicada. Todos los registros existentes se conservan. No se habilitan invitaciones ni usuarios de inmobiliarias de producción con esta PR.

Se han auditado las tablas `crm_apps`, `crm_records`, `crm_app_versions`, `crm_proposals`, `crm_messages`, `crm_organizations`, `crm_org_members`, `crm_google_accounts`, `crm_instagram_accounts`, `crm_instagram_events` y Storage `crm-property-media`. No hay vistas SQL de agencia en las migraciones actuales; cualquier nueva vista deberá crearse `security_invoker=true` (PostgreSQL 15+) y someterse a prueba. El esquema `storage` es compartido y no deben tocarse las políticas de buckets ajenos.

## Matriz de permisos

| Recurso | Propietario | Administrador | Agente | Lector |
| --- | --- | --- | --- | --- |
| Apps: ver | sí | sí | sí | sí |
| Apps: crear/renombrar/borrar | sí | no | no | no |
| Registros: ver | sí | sí | sí | sí |
| Registros: crear/editar | sí | sí | sí | no |
| Registros: borrar | sí | sí | no | no |
| Fotos/PDF privados: leer | sí | sí | sí | sí |
| Fotos/PDF privados: subir | sí | sí | sí | no |
| Fotos/PDF privados: borrar | sí | sí | no | no |
| Ajustes de organización | sí | sí | no | no |
| Miembros (RPC) | sí | sí | no | no |
| Propuestas, versiones y asistentes/integ. sensibles | propietario de app | no | no | no |
| Secretos OAuth, tokens de Instagram, eventos internos | solo servidor | solo servidor | solo servidor | solo servidor |

## Controles implantados
- `org_id NOT NULL` en apps y registros después del backfill, FK compuesta previa y disparadores inmutables: no se pueden cambiar apps de agencia ni falsificar `org_id`.
- RLS explícito por operación y rol, más permisos SQL de tabla y columna. `anon` no recibe datos de clientes ni ejecución de RPC privilegiadas.
- `SECURITY DEFINER` existente endurecido con `search_path=''` y concesiones `EXECUTE` explícitas. Los RPC de administración siguen verificando propietario de app.
- Storage privado con bucket fijo, UUIDs/rutas comprobadas *antes* de convertirlos, pertenencia del inmueble a la agencia, política de lectura para miembros, escritura restringida y borrado solo owner/admin; URLs firmadas de corta vida.
- Los Edge Functions `crm-agent`, `crm-automate`, `crm-google`, `crm-instagram`, `crm-ical` usan service role y verifican JWT/propietario explícitamente. **No dar acceso a miembros a estas funciones** hasta una auditoría funcional de cada acción. `instagram-lead-webhook` debe seguir usando secreto/verificación de Meta y app_id fijado en servidor. Las claves de servicio jamás deben exponerse al frontend.

## Pruebas automatizadas de aislamiento
`.github/workflows/tenant-security.yml` levanta PostgreSQL 16 aislado, recrea estructuras mínimas de Supabase, aplica **todas** las migraciones anteriores en orden, siembra 2 agencias legacy, verifica backfill y aplica fases 09/10; ejecuta `supabase/tests/phase10_negative_rls.sql` con `SET ROLE authenticated` y JWT por usuario ficticio.

Comprobaciones negativas: A no puede leer/escribir B ni sus miembros, app, registros o archivos; rechazos en INSERT cross-tenant; UPDATE/DELETE cross-tenant sin filas; agente no borra, lector no crea/edita/borra ni sube; RPC de membresía interagencia denegado; funciones públicas y acceso a tablas de tokens denegados; rutas de Storage mal formadas fallan cerradas. Se comprueba que owner/admin pueden realizar sus operaciones legítimas. Las pruebas usan PostgreSQL y políticas reales, **no mocks de RLS**.

## Plan para activar en Supabase
1. Crear backup y un proyecto STAGING equivalente a producción, con SQL de fases 09/10 en orden. Confirmar recuentos de apps/registros/versions/messages idénticos antes/después.
2. Ejecutar CI PostgreSQL de esta PR y luego tests con **dos cuentas auténticas** vía Supabase Auth (incluye JWT real, Edge Functions y políticas Storage). Verificar que el bucket real es privado y que no existen políticas genéricas ajenas que permitan acceso indirecto.
3. Auditar roles/privilegios de `information_schema.role_table_grants`, `pg_policies`, `pg_proc.prosecdef`, `pg_proc.proconfig`, `pg_views`, y `pg_roles`; revisar cada acción de los Edge Functions con service role.
4. Aplicar migraciones en producción, monitorizar errores RLS y acceso; solo entonces activar invitaciones/miembros. El hecho de fusionar GitHub **no despliega SQL automáticamente**.
5. Rollback `supabase/rollback/20261012200000_tenant_security_rollback.sql` existe y es **protegido**: rechaza revertir si hay miembros distintos de owner; requiere backup. Mantiene prohibición de acceso a secretos y otras mejoras seguras. Para revertir también fase 09, usar su rollback por separado, con las mismas garantías.

## Riesgos y límites
- El test en PostgreSQL local emula auth/storage; **no sustituye** una revisión en un proyecto Supabase real con JWT, firma de URLs y endpoints Edge.
- `crm_apps` y `crm_records` son los recursos comerciales principales; los tables de secretos son exclusivamente server-only. Los SQL nuevos deben pasar auditoría antes de entrar al esquema público.
- Los permisos de clientes no demuestran seguridad de Edge Functions que usan service_role: esas funciones deben continuar autorizando cada app explícitamente.
