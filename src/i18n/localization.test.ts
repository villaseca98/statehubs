import {describe,it,expect} from 'vitest';
import {DEFAULT_ORGANIZATION_LOCALE,validateOrganizationLocale} from './localization';
describe('organization international settings',()=>{
 it('has no Spain-specific default',()=>expect(DEFAULT_ORGANIZATION_LOCALE.countryCode).toBe(''));
 it('accepts Bali and Dubai',()=>{
  expect(validateOrganizationLocale({countryCode:'ID',locale:'id-ID',currency:'IDR',timeZone:'Asia/Makassar',units:'metric',markets:['ID']})).toBe(true);
  expect(validateOrganizationLocale({countryCode:'AE',locale:'ar-AE',currency:'AED',timeZone:'Asia/Dubai',units:'metric',markets:['AE']})).toBe(true);
 });
 it('rejects unknown timezone and invalid currency',()=>{
  expect(validateOrganizationLocale({...DEFAULT_ORGANIZATION_LOCALE,timeZone:'Atlantis'})).toBe(false);
  expect(validateOrganizationLocale({...DEFAULT_ORGANIZATION_LOCALE,currency:'EURO'})).toBe(false);
 });
});
