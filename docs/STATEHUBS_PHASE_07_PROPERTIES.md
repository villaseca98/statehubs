# Fase 07 — Fichas inmobiliarias y multimedia privada

## Entrega
- Ficha de inmueble/alojamiento: resumen de precio, dirección, zona, ciudad, superficie, dormitorios, baños, estado y propietario vinculado cuando esos campos existen. El editor genérico mantiene los campos, relaciones y cambios persistentes de `crm_records`.
- Galería y PDF: fotos JPG/PNG/WebP (máx. 8 MB), PDF (máx. 12 MB), carga con feedback, vista previa y enlaces firmados de cinco minutos. Se guardan únicamente rutas privadas y nombres en `crm_records.data.statehubs_media`, no URLs públicas ni binarios.
- Tarjetas de la vista de cuadrícula muestran la primera foto privada, si existe, y mantienen el fallback existente.
- Nueva migración `20261012180000_property_media.sql` crea bucket **privado** y políticas Storage RLS: solo dueño de la aplicación y solo inmuebles/alojamientos existentes del mismo app. No hay política de actualización ni lectura pública.
- Los cambios del panel reutilizan `onUpdate` y la actualización existente del registro. Los datos se reflejan en las demás vistas porque comparten el mismo array de registros.

## Despliegue obligatorio
**El bucket y sus permisos NO se crean al fusionar GitHub.** Aplicar la migración al proyecto Supabase correspondiente antes de usar la subida en producción; comprobar que el usuario autenticado puede subir/ver/borrar en su app y que otro usuario no puede leer/escribir.
La aplicación sin Supabase o sin sesión sigue mostrando ficha y registros, pero no permite subir archivos privados.

## Limitaciones actuales
- Los documentos se vinculan a un inmueble, no hay versionado ni clasificación de documentos.
- `crm_apps` todavía es propietario individual, no hay roles multiagencia; las políticas usan el modelo de seguridad actual y deberán evolucionar con la fase multi-tenant.
- El editor de registros utiliza actualizaciones optimistas: si falla el guardado del JSON, el archivo recién subido puede quedar huérfano en Storage; la limpieza transaccional requerirá una función backend en fase posterior.
- El borrado de archivo y la edición de la lista de rutas no son una transacción conjunta. Confirmar en Supabase antes de confiar en el borrado de documentación crítica.
- No hay carga de vídeo, conversión a WebP ni thumbnails del lado servidor.
- Los campos de disponibilidad y estado dependen del blueprint actual; no se inventa disponibilidad sin calendario.

## Comprobaciones
- `npm ci && npm run lint && npm test && npm run build`
- Probar en móvil y escritorio: alta de inmueble, edición de precio/propietario/estado, subida JPG/PDF, refresco, tarjeta, borrado, sin datos y fichero inválido.
- Comprobar aislamiento RLS con dos usuarios reales en Supabase.
- Verificar despliegue Ready en Vercel y URL de producción.
