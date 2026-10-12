# Fase 05 — Centro de operaciones inmobiliarias

## Entrega
El componente `OperationsDashboard` se incorpora a la pantalla «Hoy» y a la sección «Centro de operaciones» sin sustituir los módulos operativos existentes. Funciona en móvil y escritorio con tarjetas, gráfico ligero, alertas accionables y tabla de actividad por agente. Incluye filtros de 7/30/90 días.

## Origen de los indicadores
Todos los cálculos leen exclusivamente `records` cargados por `AppPage` para la aplicación actual; en sesión remota vienen de `crmApi.records(appId)` sobre `crm_records`, y en sesión invitada de `localCrmApi`. **No hay agregados globales ni datos externos**.

| Indicador | Fuente | Regla |
|---|---|---|
| Leads nuevos | `crm_records` con `entity=lead` | `created_at` dentro del intervalo |
| Visitas | `entity=visita` o `cita_inmo` | Fecha de creación dentro del intervalo; no se presenta como visitas realizadas |
| Oportunidades | `entity=oportunidad` o `operacion` | Fecha de creación dentro del intervalo; no se presenta como ventas cerradas |
| Tareas pendientes | `computeToday(blueprint, records, now)` | Hoy + vencidas, **no** restringidas por filtro temporal |
| Evolución | Leads con `created_at` | Conteo por día local del navegador |
| Agentes | `data.agente`, `data.agente_asignado` o `data.responsable` | Conteo de registros atribuidos por agente; no tasa de conversión |
| Alertas | `computeToday` | Pendientes vencidos y de hoy, con acceso al registro |

Se excluyen todos los registros con `is_sample=true` de las cifras, incluso en una aplicación de prueba; se muestra aviso con la cantidad excluida. Los registros sin `created_at` no se atribuyen a un periodo. No se inventan cifras ni se extrapolan métricas.

## Límites conocidos
- Los campos de agente son texto libre, no identidades autenticadas; no equivalen a permisos ni productividad verificable.
- El panel no registra históricos de estados ni visitas completadas; por tanto no afirma medir cierres o visitas efectuadas.
- El gráfico es CSS, sin dependencias de visualización nuevas; su resumen es accesible mediante `role=img` y texto.
- La vista actual no realiza peticiones adicionales ni modifica registros.
- El filtrado temporal se aplica a eventos **creados** en el intervalo, no a fechas de visita futura.

## Verificación
CI: `npm ci`, `npm run lint`, `npm test`, `npm run build`.
Revisión manual: pantalla Hoy y Centro de operaciones, 7/30/90 días, clic en alerta, sin registros, muestras, modo oscuro, 375px y escritorio, navegación con teclado, preview de Vercel.
