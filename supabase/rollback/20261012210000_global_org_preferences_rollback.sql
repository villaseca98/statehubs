-- Only execute after backing up and checking that no org uses these columns.
begin;
do $$
begin
 if exists(select 1 from public.crm_organizations where country_code is not null
 or preferred_locale is not null or reporting_currency is not null or time_zone is not null
 or measurement_system is not null or cardinality(operating_markets)>0)
 then raise exception 'Rollback refused: organization locale data exists'; end if;
end $$;
alter table public.crm_organizations drop column if exists country_code;
alter table public.crm_organizations drop column if exists preferred_locale;
alter table public.crm_organizations drop column if exists reporting_currency;
alter table public.crm_organizations drop column if exists time_zone;
alter table public.crm_organizations drop column if exists measurement_system;
alter table public.crm_organizations drop column if exists operating_markets;
commit;
