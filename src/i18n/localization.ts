// BCP 47 / ISO 3166 / ISO 4217 / IANA-compatible organization preferences.
// Never convert monetary values silently; source currency is retained per property.
export type OrganizationLocale = {
 countryCode:string; locale:string; currency:string; timeZone:string;
 units:'metric'|'imperial'; markets:string[];
};
export const DEFAULT_ORGANIZATION_LOCALE:OrganizationLocale = {
 countryCode:'',locale:'en',currency:'USD',timeZone:'UTC',units:'metric',markets:[]
};
export function validateOrganizationLocale(value:OrganizationLocale):boolean {
 try {
  if(value.countryCode && !/^[A-Z]{2}$/.test(value.countryCode)) return false;
  if(!/^[A-Z]{3}$/.test(value.currency)) return false;
  if(!['metric','imperial'].includes(value.units)) return false;
  if(!Array.isArray(value.markets)||value.markets.some(x=>!/^[A-Z]{2}$/.test(x))) return false;
  new Intl.Locale(value.locale);
  new Intl.NumberFormat(value.locale,{style:'currency',currency:value.currency});
  new Intl.DateTimeFormat(value.locale,{timeZone:value.timeZone});
  return true;
 } catch { return false; }
}
