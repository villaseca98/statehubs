# StateHubs — plan de tenancy, permisos y aislamiento

**Estado:** diseño técnico previo a migración. No aplicar a producción sin revisión, backup y pruebas en un proyecto Supabase separado.

## Objetivo

Permitir que varios usuarios de una misma inmobiliaria trabajen sobre los mismos leads, inmuebles, visitas y operaciones, manteniendo aislados los datos de cada agencia. La autorización debe ocurrir en PostgreSQL/RLS; la interfaz solo refleja permisos ya aplicados en servidor.

## Estado actual y por qué no basta

- `crm_apps.owner_id` representa a una persona, no a una agencia.
- `crm_owns_app(app_id)` y las políticas de las tablas relacionadas solo autorizan al propietario.
- `crmApi.createApp(ownerId)` crea el espacio a nombre de un usuario.
- No existe una relación de pertenencia de usuarios a una agencia ni un rol de gerente/agente.
- No hay asignación segura de registros a un agente ni historial de actividad comercial auditable.

No cambiar las políticas actuales por comprobaciones del cliente. La migración debe preservar las apps existentes y asignarlas a una organización inicial cuyo propietario sea su owner actual.

## Modelo de datos propuesto

### `crm_organizations`
- `id uuid primary key`
- `name text not null`
- `slug text unique`
- `created_by uuid references auth.users(id)`
- `created_at timestamptz`

### `crm_organization_members`
- `organization_id uuid references crm_organizations(id) on delete cascade`
- `user_id uuid references auth.users(id) on delete cascade`
- `role text check (role in ('owner','manager','agent'))`
- `status text check (status in ('invited','active','suspended'))`
- `created_at timestamptz`
- clave única `(organization_id, user_id)`

### Aplicaciones y registros
- Añadir `organization_id` a `crm_apps`, inicialmente nullable para migrar.
- Backfill: crear una organización por cada propietario actual, añadirlo como `owner` y asignar sus apps a esa organización.
- Validar que no quedan filas sin organización y después hacer la columna `NOT NULL`.
- Mantener `owner_id` temporalmente durante una fase de compatibilidad; eliminarlo solo en una migración posterior, después de actualizar clientes, funciones y tests.
- La pertenencia se hereda de `crm_apps.organization_id` para versiones, propuestas, mensajes y registros; evitar repetir una segunda fuente de verdad sin necesidad.
- Para asignación comercial añadir un campo `assigned_to` a las entidades que lo necesiten dentro de `data` solo como dato de negocio, pero validar en servidor que el usuario asignado pertenece a la misma organización. A largo plazo, considerar columnas tipadas si las consultas/estadísticas lo requieren.

## Reglas de autorización

- **Owner:** administra agencia, miembros, apps y datos.
- **Manager:** gestiona apps y registros comerciales de su agencia; invita agentes si el producto lo permite.
- **Agent:** lee los registros permitidos por política de agencia y crea/actualiza su trabajo; no gestiona facturación, miembros ni configuración de seguridad.
- Todas las políticas deben comprobar membresía activa en la organización a la que pertenece la app.
- Operaciones privilegiadas `SECURITY DEFINER` deben comprobar membresía y rol dentro de la propia función, no confiar en un parámetro `organization_id` enviado por el navegador.
- Revocar `EXECUTE` de funciones privilegiadas a `PUBLIC` y `anon`; conceder solo a `authenticated` cuando proceda.
- Usar `set search_path = ''` y referencias completamente cualificadas en funciones privilegiadas cuando sea compatible con la implementación.
- No permitir que una invitación cambie un usuario a `owner` por un simple `INSERT/UPDATE` desde el cliente.
- Nunca usar la clave `service_role` en el bundle del navegador.

## Orden de implementación

1. Crear pruebas SQL de aislamiento y revisar todas las políticas/funciones existentes.
2. Crear tablas de organizaciones y membresías, índices y restricciones.
3. Migrar datos existentes sin cambiar todavía la semántica de acceso.
4. Crear helpers de autorización seguros para pertenencia y roles.
5. Añadir políticas RLS por tabla y revisar las políticas de `INSERT`, `UPDATE`, `DELETE` y `SELECT` individualmente.
6. Actualizar `crmApi`, onboarding y selector de agencia para usar la organización activa del usuario.
7. Añadir gestión de invitaciones/miembros con tokens de un solo uso, caducidad y permisos limitados.
8. Ejecutar pruebas de roles y aislamiento; verificar que las apps existentes siguen accesibles a sus propietarios.
9. Desplegar primero en staging, probar restauración de backup y solo después preparar un piloto con datos personales.

## Pruebas negativas obligatorias

- Usuario de Agencia A no puede leer, enumerar, modificar ni borrar apps, registros, mensajes, propuestas o versiones de Agencia B.
- Un agente no puede invitar miembros, elevar roles, cambiar la organización de una app ni aplicar acciones reservadas al gerente.
- Un usuario suspendido pierde acceso inmediatamente.
- No se puede asignar un lead a una persona de otra organización.
- Un usuario no puede llamar directamente a las funciones RPC con IDs de otra agencia para aplicar propuestas, restaurar versiones, descartar propuestas o borrar ejemplos.
- Un propietario actual conserva el acceso a sus apps tras el backfill.
- Las políticas funcionan sin sesión y con IDs aleatorios; las rutas de error no revelan si existe un recurso ajeno.

## Criterios para considerar el trabajo listo

- Tests de migración/backfill pasan en una base desechable con datos de dos agencias.
- Tests RLS prueban permisos positivos y negativos para owner, manager, agent, suspendido y anónimo.
- Se revisan explícitamente todas las funciones `SECURITY DEFINER`, triggers y grants.
- Se documentan backups, recuperación, exportación y eliminación de datos.
- No se declara listo para producción hasta confirmar el resultado real de CI y revisar el despliegue de Supabase.
