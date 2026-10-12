# StateHubs — Fase 08: accesibilidad y adaptación responsive

## Fases y alcance
1. **Auditoría estática:** `Workspace`, `RecordPanel`, `RecordCalendar`, `FilterBar` y `views`. Riesgos: panel sin semántica de diálogo, Escape/foco sin gestión, botones inferiores a 44px, controles estrechos y scroll horizontal.
2. **Corrección implementada:** `RecordDialog` accesible con `role=dialog`, `aria-modal`, nombre, foco inicial, bucle de tabulación, Escape, clic fuera y devolución de foco; objetivos táctiles de 44px para barra y acciones principales; inputs con altura mínima, foco visible global, tamaño de controles móvil anti-zoom y respeto de movimiento reducido.
3. **Regresión automatizada:** pruebas unitarias de nombre/semántica del panel, Escape y backdrop; pipeline de lint, tests y build.
4. **Validación manual pendiente:** dispositivos reales y auditoría WCAG 2.2 AA exhaustiva requieren navegador y tecnologías de asistencia; **no se declara certificación**.

## Matriz de comprobación manual (no verificada aún)
| Dispositivo | Anchura orientativa | Comprobar |
| --- | --- | --- |
| iPhone SE / Safari | 375px | Dock inferior, safe-area, inputs sin zoom, panel completo, teclado virtual |
| iPhone Pro / Safari | 393–430px | Targets >=44px, navegación, formulario y carrusel de secciones |
| Android / Chrome | 360–412px | Teclado virtual, scroll horizontal de tabla y Kanban, panel y calendario |
| Tablet / Safari o Chrome | 768–1024px | Transición dock/cabecera, panel, filtros, tablas |
| Escritorio / Chrome, Firefox, Safari | 1280–1920px | Zoom 200–400%, teclado, diálogos, lectores de pantalla |

## WCAG 2.2 AA — comprobaciones recomendadas
- 2.1.1 teclado y 2.1.2 sin trampas: recorrer controles y salir de panel con Escape.
- 2.4.3 orden de foco, 2.4.7 foco visible, 2.4.11 foco no oculto.
- 2.5.8 tamaño mínimo de objetivo: medir controles de barra, filtros y menús (24px AA; se prioriza 44px donde procede).
- 1.3.1 relaciones de etiquetas, 1.4.10 reflow a 320px, 1.4.11 contraste no textual.
- 3.3.2 etiquetas e instrucciones; 4.1.2 nombre/rol/valor; movimiento reducido.

## Limitaciones
- Las vistas de Kanban, filtros emergentes y calendarios complejos necesitan una revisión de teclado/lector de pantalla adicional. Esta PR no acredita cumplimiento integral WCAG.
- `jsdom` no reproduce layout ni lectores de pantalla; los tests no equivalen a pruebas de iOS/Android.
- No se ha incorporado Playwright ni capturas reales. Se recomienda una fase de pruebas E2E multi-viewport antes de certificar accesibilidad.
