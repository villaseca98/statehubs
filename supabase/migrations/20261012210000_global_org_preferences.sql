-- Phase 11 additive localization: no deletion, no tenant ownership changes.
-- Keep organization settings as existing JSONB; do not rewrite existing settings.
alter table public.crm_organizations add column if not exists country_code text;
alter table public.crm_organizations add column if not exists preferred_locale text;
alter table public.crm_organizations add column if not exists reporting_currency text;
alter table public.crm_organizations add column if not exists time_zone text;
alter table public.crm_organizations add column if not exists measurement_system text;
alter table public.crm_organizations add column if not exists operating_markets text[] not null default '{}';
alter table public.crm_organizations add constraint crm_org_country_code_valid
 check(country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.crm_organizations add constraint crm_org_locale_valid
 check(preferred_locale is null or preferred_locale ~ '^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$');
alter table public.crm_organizations add constraint crm_org_currency_valid
 check(reporting_currency is null or reporting_currency ~ '^[A-Z]{3}$');
alter table public.crm_organizations add constraint crm_org_measurement_valid
 check(measurement_system is null or measurement_system in ('metric','imperial'));
alter table public.crm_organizations add constraint crm_org_markets_valid
 check(array_position(operating_markets,null) is null);
-- No global country default; existing tenants stay unmodified. UTC/en are UI fallbacks.
-- Preserve RLS: only owner/admin can update these new columns via existing UPDATE policy.
grant update(country_code,preferred_locale,reporting_currency,time_zone,measurement_system,operating_markets)
 on public.crm_organizations to authenticated;
-- ISO currency is stored as metadata; property price conversion requires dated FX rates.
-- Do not change legacy CRM JSON payloads or monetary values.
