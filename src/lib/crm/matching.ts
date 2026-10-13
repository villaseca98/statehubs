import type { AppRecord, RecordData } from '@shared/blueprint/types';
import { CURRENCY_CODES } from './currencies';
import { contactRoles } from './contactLifecycle';
export const CONTACT_ENTITIES = new Set(['contacto_inmo','lead','cliente']);
export type MatchCriterion = 'availability'|'intent'|'budget'|'currency'|'location'|'type'|'bedrooms'|'bathrooms'|'area'|'features'|'exclusions'|'timeframe'|'use';
export interface MatchReason { criterion: MatchCriterion; state: 'match'|'missing'|'conflict'; detail: string }
export interface PropertyMatch { contact: AppRecord; property: AppRecord; score: number | null; reasons: MatchReason[]; eligible: boolean; dormant: boolean }
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
export const normalizeMatchText = (v: unknown) => str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const tags = (v: unknown) => [...new Set(str(v).split(/[,;\n]/).map(normalizeMatchText).filter(Boolean))];
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export const currencyOf = (data: RecordData) => (CURRENCY_CODES as readonly string[]).includes(str(data.moneda).toUpperCase()) ? str(data.moneda).toUpperCase() : '';
export function intentOf(data: RecordData): 'sale'|'rent'|'' {
 if ('match_intent' in data && data.match_intent !== 'sale' && data.match_intent !== 'rent') return '';
 if (data.match_intent === 'sale' || data.match_intent === 'rent') return data.match_intent;
 const roles = contactRoles(data); const buying=roles.some(r=>r==='comprador'||r==='inversor');const renting=roles.includes('arrendatario');
 return buying === renting ? '' : renting ? 'rent' : 'sale';
}
const validDay = (value: unknown) => { const text=str(value); const stamp=Date.parse(text); return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===text?text:''; };
export function matchProperty(contact: AppRecord, property: AppRecord, now = new Date()): PropertyMatch {
 const c=contact.data,p=property.data; const reasons: MatchReason[]=[];
 const add=(criterion: MatchCriterion,state: MatchReason['state'],detail:string)=>reasons.push({criterion,state,detail});
 const inactive=c.crm_archived===true || ['descartado','perdido'].includes(str(c.temperatura)) || c.estado==='perdido';
 const supported=CONTACT_ENTITIES.has(contact.entity) && property.entity==='inmueble' && !inactive && Boolean(contact.is_sample)===Boolean(property.is_sample);
 const available=p.estado==='disponible';
 add('availability',available?'match':!p.estado?'missing':'conflict',str(p.estado));
 const intent=intentOf(c);const operation=p.operacion==='venta'?'sale':p.operacion==='alquiler'?'rent':'';
 add('intent',!intent||!operation?(p.operacion==='turistico'?'conflict':'missing'):intent===operation?'match':'conflict',`${intent || '?'} / ${operation || '?'}`);
 const currency=currencyOf(c),propertyCurrency=currencyOf(p);
 add('currency',!currency||!propertyCurrency?'missing':currency===propertyCurrency?'match':'conflict',`${currency || '?'} / ${propertyCurrency || '?'}`);
 const budget=num(c.presupuesto),price=num(p.precio);
 add('budget',budget===null||price===null||!currency||currency!==propertyCurrency?'missing':price<=budget?'match':'conflict',budget===null||price===null?'':`${price} / ${budget} ${propertyCurrency}`);
 const zones=tags(c.zonas);const propertyZones=[normalizeMatchText(p.zona),normalizeMatchText(p.ciudad)].filter(Boolean);
 if(zones.length) add('location',!propertyZones.length?'missing':zones.some(z=>propertyZones.includes(z))?'match':'conflict',str(p.zona)||str(p.ciudad));
 if(c.tipo_deseado) add('type',!p.tipo?'missing':c.tipo_deseado===p.tipo?'match':'conflict',str(p.tipo));
 for(const [criterion,wanted,actual] of [['bedrooms',c.habitaciones_min,p.habitaciones],['bathrooms',c.match_bathrooms_min,p.banos],['area',c.metros_min,p.metros??p.superficie]] as const){
  const minimum=num(wanted);if(minimum===null)continue;const value=num(actual);
  add(criterion,value===null?'missing':value>=minimum?'match':'conflict',`${value??'?'} / ${minimum}`);
 }
 const features=tags(p.match_features);const required=tags(c.match_features);const exclusions=tags(c.match_exclusions);
 if(required.length) add('features',!str(p.match_features)?'missing':required.every(f=>features.includes(f))?'match':'conflict',required.join(', '));
 if(exclusions.length) add('exclusions',p.match_features_verified!==true?'missing':exclusions.some(f=>features.includes(f))?'conflict':'match',exclusions.join(', '));
 if(c.match_use) add('use',!p.match_use?'missing':normalizeMatchText(c.match_use)===normalizeMatchText(p.match_use)?'match':'conflict',str(p.match_use));
 const by=validDay(c.match_by),from=validDay(p.match_available_from);
 if(by) add('timeframe',!from?'missing':from<=by?'match':'conflict',from);
 const essential=reasons.filter(r=>['currency','budget','intent','availability'].includes(r.criterion));
 const score=essential.some(r=>r.state!=='match')?null:Math.round(100*reasons.filter(r=>r.state==='match').length/reasons.length);
 const last=validDay(c.match_last_contact);const elapsed=last?(now.getTime()-Date.parse(last))/86400000:0;
 return {contact,property,reasons,score,eligible:supported && !reasons.some(r=>r.state==='conflict'),dormant:!!last&&elapsed>=30&&elapsed>=0};
}
export function matchesForRecord(record: AppRecord, records: AppRecord[], qualifiedOnly=true): PropertyMatch[] {
 const candidates=record.entity==='inmueble'
  ? records.filter(r=>CONTACT_ENTITIES.has(r.entity)&&(!qualifiedOnly||r.data.match_qualified===true)).map(c=>matchProperty(c,record))
  : CONTACT_ENTITIES.has(record.entity)?records.filter(r=>r.entity==='inmueble').map(p=>matchProperty(record,p)):[];
 return candidates.filter(m=>m.eligible).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.property.id.localeCompare(b.property.id)||a.contact.id.localeCompare(b.contact.id));
}
