# StateHubs

**Tu CRM o tu ERP, montado a piezas.** Un CRM que, al abrirlo, te dice qué toca hoy.

- **Hoy**: la pantalla de inicio junta lo atrasado (cobros vencidos, citas sin cerrar, tareas pasadas de fecha), lo de hoy (citas, leads nuevos sin contactar, stock bajo mínimos) y lo de los próximos días. WhatsApp o llamada con un toque.
- **Piezas**: Leads, Embudo, Agenda, Clientes, Presupuestos, Soporte, Facturas y cobros, Pedidos, Inventario, Compras, Gastos, Proyectos, Operaciones y procesos, Documentación, Automatizaciones. Se ponen y se quitan sin perder datos.
- **IA**: «añade la provincia a los clientes». La IA solo escribe el plano (JSON), nunca código. Cada cambio llega como propuesta, se ve sobre tus datos antes de aplicarlo y queda como versión con vuelta atrás.
- **Automatizaciones**: cuando entra un lead o se cobra una factura, avisa a tu n8n, Make o Zapier por webhook.
- **Visuales**: portada con la app en 3D, botón «Verlo en 3D» con la app del propio cliente y reels verticales para anuncios.

Un solo diseño, el de StateHubs. Sin catálogos de estilos.

## Arrancar

```bash
npm install
npm run dev        # http://127.0.0.1:8080
npm test
npm run build
```

Sin variables de entorno funciona en **modo prueba**: cada app se guarda en el navegador y no hace falta cuenta. En modo prueba la IA local entiende «añade facturas» o «quita soporte»; para lo demás hace falta el servidor.

## Con servidor (Supabase)

1. Copia `.env.example` a `.env` y pon `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Aplica la migración `supabase/migrations/20261010120000_crm_builder.sql` (tablas `crm_*`, políticas y funciones `crm_apply_proposal`, `crm_restore_version`…).
3. Despliega las funciones: `supabase functions deploy crm-agent crm-automate`.
4. Añade el secreto de la IA: `supabase secrets set ANTHROPIC_API_KEY=...`.
5. En *Authentication → URL Configuration* pon tu dominio como Site URL y `https://tu-dominio/**` en Redirect URLs. Activa Google y el email con enlace.

## Desplegar

Vercel o cualquier hosting estático: `npm run build` y servir `dist/` con reescritura de rutas a `index.html` (ya está en `vercel.json`).

## Estructura

```
src/
  pages/Landing.tsx            Portada: historia en 3D, CRM o ERP en un clic, o pedírselo a la IA
  pages/AppPage.tsx            La app abierta + paneles de Piezas, IA e Historial
  pages/Demo.tsx               Demo sin cuenta (CRM, ERP y plantillas por sector)
  pages/Login.tsx              Google o enlace por email
  pages/reels/Reels.tsx        Anuncios 1080×1920 (/reels, /reels/:clave)
  components/crm/Workspace     Menú lateral, una sección cada vez, ficha en panel lateral
  components/crm/TodayView     La pantalla «Hoy»
  components/crm/AppShowcase   Motor 3D: despieza cualquier app en capas
  lib/crm/today.ts             Qué toca hoy, a partir de cualquier plano
  lib/crm/api.ts, localApi.ts  Servidor (Supabase) y modo prueba (navegador), misma interfaz
supabase/functions/
  _shared/blueprint/           Plano: tipos, validación, piezas, diff, agente, automatizaciones, look
  crm-agent/                   La IA que propone cambios (Claude)
  crm-automate/                Envía los webhooks de las automatizaciones
```

## Reels

`/reels/<clave>?capture=1` deja el reloj quieto y `window.__reel.set(segundos)` lo mueve. `scripts/render-reels.mjs` los exporta a MP4.
