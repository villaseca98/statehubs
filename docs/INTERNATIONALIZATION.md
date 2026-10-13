# Internationalization

Current code: `src/i18n/index.tsx` has inline EN/ES entry-point messages, persisted manual choice, English fallback and fixed LTR. `localization.ts` validates organization preferences; phase 11 adds optional database columns. These columns are not yet fully selected/updated by `crmApi` or wired into CRM formatting. Many components and blueprints are Spanish-only; `theme.ts` formats EUR/es-ES and calendar helpers default to Madrid.

Target deliveries:

1. Split typed catalogs by common/auth/navigation/crm/properties/rentals/errors. Move labels, validation and notifications out of components. Preserve Spanish stored keys and values; translate their display labels.
2. Preference resolution: explicit user choice → organization preference where available → supported browser language → English. Persist choice; test unavailable storage and unsupported locales.
3. Pass org locale/currency/timezone through a runtime context. Never relabel existing EUR values as USD when a preference changes. Original monetary currency is authoritative; no fabricated FX conversions.
4. Separate date-only stays, UTC instants, and timezone-local appointment input. Validate nonexistent/ambiguous daylight-saving times. Test US, UK, Madrid, Dubai and Asian zones, including midnight and DST boundaries.
5. Add complete reviewed catalogs for PT/FR/IT/DE/AR/NL/ID/TH. Arabic uses `dir=rtl`, logical CSS properties and mirrored navigation where appropriate. Do not advertise a language from a partially filled catalog.
6. Public localized indexable routes, canonical/hreflang, translated metadata, sitemap and OG. Emit only existing public URLs; never index private app data. Server rendering/prerendering is a separate measured delivery, not provided by client-only translation.

Server errors should evolve to stable codes with localized UI messages. Transactional email templates and provider notifications require explicit locales. Do not send private CRM data to a translation service by default. Current validation checks currency shape/Intl acceptance, not a complete ISO registry or financial ledger.
