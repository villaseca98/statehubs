import {describe,it,expect} from 'vitest';
import {analyzeDealMomentum} from './dealMomentum';
describe('deal momentum',()=>{
 const r=(id:string,data:Record<string,unknown>)=>({id,entity:'operacion',data});
 it('flags missing actions, overdue follow-ups and excludes closed deals',()=>{
  const result=analyzeDealMomentum([r('a',{}),r('b',{fecha_seguimiento:'2026-01-01'}),r('c',{estado:'cerrado'})] as never[],new Date('2026-02-01T12:00:00Z'));
  expect(result.map(x=>x.health)).toEqual(['insufficient_data','needs_attention']);
 });
 it('does not invent a conversion probability',()=>{
  expect(analyzeDealMomentum([r('a',{proxima_accion:'Call buyer'})] as never[],new Date('2026-02-01T12:00:00Z'))[0].health).toBe('on_track');
 });
});
