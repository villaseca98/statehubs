import { describe, expect, it } from 'vitest';
import type { AppRecord } from '@shared/blueprint/types';
import { matchProperty, matchesForRecord, intentOf, currencyOf } from './matching';
const contact:AppRecord={id:'c',entity:'contacto_inmo',data:{nombre:'Buyer',tipo:'comprador',presupuesto:300000,moneda:'EUR',zonas:'Ruzafa',tipo_deseado:'piso',habitaciones_min:2,match_qualified:true}};
const property:AppRecord={id:'p',entity:'inmueble',data:{direccion:'Home',operacion:'venta',estado:'disponible',precio:250000,moneda:'EUR',zona:'Rúzafa',tipo:'piso',habitaciones:3}};
const c=(data:AppRecord['data'])=>({...contact,data:{...contact.data,...data}});
const p=(data:AppRecord['data'])=>({...property,data:{...property.data,...data}});
describe('explainable matching',()=>{
 it('explains each verified criterion without inventing a probability',()=>{
  const result=matchProperty(contact,property);expect(result.eligible).toBe(true);expect(result.score).toBe(100);
  expect(result.reasons.map(r=>r.criterion)).toContain('budget');expect(result.reasons.every(r=>r.state==='match')).toBe(true);
 });
 it('does not compare different or missing currencies',()=>{
  expect(matchProperty(contact,p({moneda:'USD'})).eligible).toBe(false);
  const missing=matchProperty(c({moneda:null}),property);expect(missing.score).toBeNull();expect(missing.reasons.find(r=>r.criterion==='budget')?.state).toBe('missing');
  expect(currencyOf({moneda:'ZZZ'})).toBe('');
 });
 it('separates tenant monthly budget from purchase price, including multi-role contacts',()=>{
  expect(matchProperty(c({tipo:'arrendatario'}),property).eligible).toBe(false);
  expect(intentOf({tipo:'comprador',crm_role_arrendatario:true})).toBe('');
  expect(intentOf({tipo:'comprador',match_intent:null})).toBe('');
  expect(matchProperty(c({tipo:'arrendatario',presupuesto:1400}),p({operacion:'alquiler',precio:1300})).eligible).toBe(true);
 });
 it.each([{precio:310000},{habitaciones:1},{estado:'vendido'},{operacion:'turistico'},{zona:'Ruzafa Norte'}])('rejects an explicit conflict %j',data=>{expect(matchProperty(contact,p(data)).eligible).toBe(false);});
 it('does not use missing dimensions as evidence',()=>{
  const result=matchProperty(c({match_bathrooms_min:2,metros_min:90}),property);
  expect(result.score).toBeLessThan(100);expect(result.reasons.filter(r=>r.state==='missing').map(r=>r.criterion)).toEqual(['bathrooms','area']);
 });
 it('checks must-haves, exclusions, use and dates',()=>{
  const buyer=c({match_features:'Lift, Parking',match_exclusions:'stairs',match_use:'investment',match_by:'2026-12-01'});
  const home=p({match_features:'parking,lift',match_features_verified:true,match_use:'investment',match_available_from:'2026-11-01'});
  expect(matchProperty(buyer,home).score).toBe(100);
  expect(matchProperty(buyer,{...home,data:{...home.data,match_features:'stairs,lift,parking'}}).eligible).toBe(false);
  expect(matchProperty(buyer,{...home,data:{...home.data,match_available_from:'2027-01-01'}}).eligible).toBe(false);
 });
 it('exposes qualification and legitimate Instagram records without outbound contact',()=>{
  const instagram=c({origen:'instagram',match_last_contact:'2026-08-01'});
  expect(matchProperty(instagram,property,new Date('2026-10-13')).dormant).toBe(true);
  expect(matchesForRecord(property,[instagram])).toHaveLength(1);
  expect(matchesForRecord(property,[c({match_qualified:false})])).toHaveLength(0);
 });
 it('excludes archived contacts and keeps samples separate from real data',()=>{
  expect(matchProperty(c({crm_archived:true}),property).eligible).toBe(false);
  expect(matchProperty({...contact,is_sample:true},property).eligible).toBe(false);
 });
});
