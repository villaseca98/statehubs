import {describe,expect,it} from 'vitest';
import {matchOpportunities} from './matchIntelligence';
import type {AppRecord} from '@shared/blueprint/types.ts';
const record=(id:string,entity:string,data:AppRecord['data'])=>({id,entity,data} as AppRecord);
describe('international matching aliases',()=>{
 it('connects a buyer with an available English-language property',()=>{
  const records=[record('p1','property',{transaction_type:'sale',status:'available',price:250000,currency:'EUR',area:'Lisbon',bedrooms:3}),record('b1','lead',{intent:'buy',budget:300000,currency:'EUR',preferred_areas:'Lisbon',min_bedrooms:2})];
  const matches=matchOpportunities(records,'sale');
  expect(matches).toHaveLength(1);
  expect(matches[0].score).toBe(100);
  expect(matches[0].property.id).toBe('p1');
 });
 it('does not match properties in another currency without a conversion rate',()=>{
  const records=[record('p1','property',{transaction_type:'sale',price:250000,currency:'USD'}),record('b1','lead',{intent:'buy',budget:300000,currency:'EUR'})];
  expect(matchOpportunities(records,'sale')).toEqual([]);
 });
 it('excludes already sold properties',()=>{
  const records=[record('p1','property',{transaction_type:'sale',status:'sold',price:250000}),record('b1','lead',{intent:'buy',budget:300000})];
  expect(matchOpportunities(records,'sale')).toEqual([]);
 });
});
