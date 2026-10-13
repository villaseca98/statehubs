import { useState } from 'react';
import type { AppRecord, RecordData } from '@shared/blueprint/types';
import { matchingText as t, propertyTypeLabels } from '@/i18n/matching';
import { CURRENCY_CODES } from '@/lib/crm/currencies';
import { currencyOf, intentOf } from '@/lib/crm/matching';
const input='mt-1 min-h-11 w-full rounded-lg border px-3 py-2 text-sm';
export function MatchingProfile({record,readOnly,onUpdate}:{record:AppRecord;readOnly:boolean;onUpdate:(id:string,patch:RecordData)=>void}) {
 const property=record.entity==='inmueble';const d=record.data;const [error,setError]=useState('');
 const set=(key:string,value:unknown)=>{if(!readOnly)onUpdate(record.id,{[key]:value});};
 const fields:[string,string,'text'|'number'|'date'][]=property?[
  ['precio',t.price,'number'],['match_features',t.propertyFeatures,'text'],['match_use',t.use,'text'],['match_available_from',t.availableFrom,'date']
 ]:[['presupuesto',t.budget,'number'],['zonas',t.location,'text'],['habitaciones_min',t.bedrooms,'number'],['match_bathrooms_min',t.bathrooms,'number'],['metros_min',t.area,'number'],['match_features',t.features,'text'],['match_exclusions',t.exclusions,'text'],['match_use',t.use,'text'],['match_by',t.by,'date'],['match_last_contact',t.last,'date']];
 return <details className="my-4 rounded-xl border p-4" style={{borderColor:'var(--crm-border)'}}><summary className="cursor-pointer text-sm font-semibold">{t.preferences}</summary>
  <fieldset disabled={readOnly} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
   <label className="text-sm">{t.currency}<select value={currencyOf(d)} onChange={e=>set('moneda',e.target.value||null)} className={input} style={{background:'var(--crm-surface)'}}><option value="">{t.unknown}</option>{CURRENCY_CODES.map(code=><option key={code}>{code}</option>)}</select></label>
   {!property && <><label className="text-sm">{t.intent}<select value={intentOf(d)} onChange={e=>set('match_intent',e.target.value||null)} className={input} style={{background:'var(--crm-surface)'}}><option value="">{t.unknown}</option><option value="sale">{t.sale}</option><option value="rent">{t.rent}</option></select></label>
   <label className="text-sm">{t.type}<select value={typeof d.tipo_deseado==='string'?d.tipo_deseado:''} onChange={e=>set('tipo_deseado',e.target.value||null)} className={input} style={{background:'var(--crm-surface)'}}><option value="">{t.unknown}</option>{Object.entries(propertyTypeLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></>}
   {fields.map(([key,label,type])=><label key={key} className="text-sm">{label}<input key={`${record.id}:${key}:${String(d[key]??'')}`} type={type} min={type==='number'?0:undefined} step={type==='number'?'any':undefined} defaultValue={typeof d[key]==='string'||typeof d[key]==='number'?String(d[key]):''} className={input} style={{background:'var(--crm-surface)'}} onBlur={e=>{
    if(!e.target.checkValidity()){setError(t.preferencesError);return;}setError('');const value=e.target.value===''?null:type==='number'?Number(e.target.value):e.target.value;
    if(value!==d[key])set(key,value);
   }}/></label>)}
   <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={d[property?'match_features_verified':'match_qualified']===true} onChange={e=>set(property?'match_features_verified':'match_qualified',e.target.checked)} style={{accentColor:'var(--crm-primary)'}} />{property?t.verified:t.qualified}</label>
  </fieldset>{error&&<p role="alert" className="mt-2 text-sm">{error}</p>}
 </details>;
}
