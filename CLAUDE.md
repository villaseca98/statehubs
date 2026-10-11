# StateHubs — CLAUDE.md

Constructor de CRM y ERP para pymes y autónomos en España. Español de España en toda la interfaz, claro y sin tecnicismos.

## Ideas que no se negocian

- **Un CRM que dice qué toca hoy.** La app abre en «Hoy» (`lib/crm/today.ts`). Todo lo nuevo debe alimentar o respetar esa pantalla: fechas útiles (cita, vence, límite, entrega, caduca) y estados con un final claro.
- **Limpio.** Una sección cada vez, ficha en panel lateral, herramientas (Piezas, IA, Historial, 3D) abajo en el menú. No volver a meter todo en una página ni catálogos de estilos: hay un solo diseño (`_shared/blueprint/look.ts`).
- **La IA solo escribe el plano** (JSON: entidades, campos, vistas). Nunca código.
- **Propuesta antes de aplicar, siempre con vuelta atrás.** Cada aplicación crea una versión; deshacer crea otra. Nunca se reescribe el historial.
- **Nunca cambies la `key` de algo existente** en un plano: los datos dependen de ella. Quitar un campo o una pieza lo oculta, no lo borra.
- **Modo prueba y servidor con la misma interfaz** (`localApi.ts` imita a `api.ts`). Lo que funcione en uno debe funcionar en el otro.

## Cómo trabajar

- Lee el archivo entero antes de tocarlo y sigue su estilo.
- Antes de dar algo por terminado: `npm run build`, `npm test` y `npm run lint` sin errores.
- Cambios visibles: míralos en móvil (390 px) y escritorio.
- Los estilos de texto y colores van por variables CSS (`--crm-*` en la app, tokens de Tailwind en el resto).
