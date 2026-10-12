# StateHubs global internationalization — incremental audit

## Actual architecture (2026-10-12)
React 18 + TypeScript + Vite 5 + React Router 6 + Tailwind + Supabase. Client routes: `/`, `/entrar`, `/demo`, `/app/:appId`, `/reels`. CRM app, runtime blueprint modules, AI functions, calendar, Instagram and media storage are separate components. No pre-existing i18n dependency.

## Findings
- The public landing is currently hard-coded in Spanish across `Landing`, `ScrollHero`, `Features`, `Sections`, `Mockups`; CRM UI and blueprints also contain hundreds of Spanish phrases.
- HTML had `lang=es`, Spanish SEO metadata; old palette includes forest green, lime, sage and gold, contrary to the newly approved white/black/red brand.
- CRM data models contain Spanish entity keys such as `inmueble`, `alojamiento`, `compraventa`; these are **stable internal identifiers** and MUST NOT be translated without a data migration.
- Organization `settings` is JSONB and is RLS protected by phases 09/10. Additive locale columns do not alter ownership or expose other tenants.
- OAuth secrets and server-side credentials must remain on the server. Internationalization must not send private CRM records to public translation services.
- No exchange-rate provider is configured. Prices must remain in their original currency until a dated and sourced conversion service is added.
- User-supplied official brand image is not yet stored as a GitHub asset: replacing the mark everywhere requires uploading its exact bytes rather than approximating the artwork.

## Incremental delivery plan
1. **Phase A / foundation PR:** document audit, English HTML and SEO, bilingual locale provider with persistent manual EN/ES selection, locale utilities, additive org settings, first public entry points, red/white design tokens, CI checks. Keep existing modules operational.
2. **Phase B:** extract every landing section and every CRM string into complete EN/ES catalogs; cover forms, errors, notifications and email templates. Only then claim full Spanish and English coverage.
3. **Phase C:** settings UI and RLS-backed preferences; property currency metadata, commission settings, market modules, international addresses and phone formats; migration and regression tests.
4. **Phase D:** SEO localized real pages (distinct route content, canonical/hreflang, sitemap), accessibility/RTL, real-browser translation tests.
5. **Phase E:** staging Supabase RLS tests across two agencies and Vercel preview smoke tests; enable release only after verified.

## Compatibility and risks
No existing rows are rewritten. This first PR does **not** claim full internationalization of the CRM, emails, server messages, every landing section, or browser automatic translation. Chrome's translate prompt cannot be forced. Do not publish hreflang URLs until those pages exist. Database migration must be applied separately from a GitHub merge. Official logo upload and complete visual replacement are still pending.
