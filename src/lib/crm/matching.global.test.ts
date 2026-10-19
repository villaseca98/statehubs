import { describe, expect, it } from 'vitest';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { canPersistMatch, matchesForMode, matchesForRecord } from './matching';
const record=(id:string,entity:string,data:AppRecord['data'])=>({id,entity,data} as AppRecord);
// English-schema blueprints go through the same engine as the Spanish keys.
describe('international aliases in the single matching engine',()=>{
 const home=record('p1','property',{transaction_type:'sale',status:'available',price:250000,currency:'EUR',area:'Lisbon',bedrooms:3});
 const buyer=record('b1','lead',{intent:'buy',budget:300000,currency:'EUR',preferred_areas:'Lisbon',min_bedrooms:2,match_qualified:true});
 it('connects a buyer with an available English-language property',()=>{
  const matches=matchesForMode([home,buyer],'sale');
  expect(matches).toHaveLength(1);expect(matches[0].score).toBe(100);expect(matches[0].property.id).toBe('p1');
 });
 it('is bidirectional with identical results',()=>{
  expect(matchesForRecord(home,[home,buyer])[0].score).toBe(matchesForRecord(buyer,[home,buyer])[0].score);
 });
 it('does not match another currency without a conversion rate',()=>{
  expect(matchesForMode([record('p1','property',{...home.data,currency:'USD'}),buyer],'sale')).toEqual([]);
 });
 it('excludes sold properties and rentals for buyers',()=>{
  expect(matchesForMode([record('p1','property',{...home.data,status:'sold'}),buyer],'sale')).toEqual([]);
  expect(matchesForMode([record('p1','property',{...home.data,transaction_type:'rent'}),buyer],'rent')).toEqual([]);
 });
 it('only persists decisions for the core entities the server accepts',()=>{
  expect(canPersistMatch(buyer,home)).toBe(false);
  expect(canPersistMatch(record('c','contacto_inmo',{}),record('p','inmueble',{}))).toBe(true);
 });
});
