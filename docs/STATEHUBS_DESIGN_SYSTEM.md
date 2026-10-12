# StateHubs — Design System v1

## Identidad
Producto SaaS inmobiliario premium: verde bosque, marfil, acentos salvia y lima. StateHubs es la única marca del producto. Las inmobiliarias pueden tener sus propias marcas como clientes.

## Fuentes de estilos
- `src/design/tokens.ts`: escala documentada de colores, tipografía, espaciado, radios, elevaciones, animaciones e iconos.
- `tailwind.config.ts`: colores `estate-*`, elevaciones `shadow-sh-*`, radios `rounded-sh-*`, transición `ease-sh`.
- `src/index.css`: variables semánticas, clases opt-in `sh-surface`, `sh-focus`, `sh-elevate`.
- `supabase/functions/_shared/blueprint/look.ts`: aspecto del CRM en claro/oscuro y colores del logo. La propiedad `BRAND.red` se conserva temporalmente por compatibilidad, pero ahora representa verde.

## Componentes reutilizables
- `SHButton`: primary, secondary, ghost, danger; sm, md, lg; disabled y loading. Usa `type=button` por defecto; para formularios indicar `type=submit`.
- `SHSurface`: superficies default, soft y forest; semántica div/section/article y elevación opcional.
- `SHStatus`: neutral, success, warning y danger; siempre con texto, no solo color.
- Importar desde `@/design`. Migrar pantallas antiguas gradualmente, sin reescribir el CRM.

## Accesibilidad y rendimiento
El foco de teclado es visible. Los efectos hover solo se activan con punteros precisos; movimiento reducido desactiva animaciones. Evitar 3D pesado en tareas operativas. Verificar contraste y estados con pruebas de navegador.

## Comprobaciones obligatorias antes del merge
1. `npm ci`
2. `npm run build`
3. `npm run lint`
4. `npm test` (incluye `src/design/design.test.tsx`)
5. Revisar landing, demo, login, CRM, modo oscuro y móviles en preview Vercel.
6. Comprobar marca y ausencia de regresiones visuales.

**Estado:** cambios creados en GitHub. No se han ejecutado las pruebas ni inspeccionado el preview de Vercel en esta fase. No fusionar sin validación.
