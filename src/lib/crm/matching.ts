import type { AppRecord, RecordData } from '@shared/blueprint/types';
import { CURRENCY_CODES } from './currencies';
import { contactRoles } from './contactLifecycle';
import { isProperty } from './propertyFeed';
// One deterministic engine for every matching surface (record panel, Matcher,
// map, search). Spanish keys are the blueprint's own; English aliases cover
// international schemas. Decisions persist only for the core entities the
// server RPC accepts (`canPersistMatch`).
export const CONTACT_ENTITIES = new Set(['contacto_inmo','lead','cliente']);
const CONTACT_ALIASES = /^(contacto_inmo|lead|leads|cliente|contact|contacts|buyer|buyers|tenant|tenants|prospect|prospects)$/i;
export const isMatchContact = (entity: string) => CONTACT_ALIASES.test(entity);
export const canPersistMatch = (contact: AppRecord, property: AppRecord) => CONTACT_ENTITIES.has(contact.entity) && property.entity === 'inmueble';
export type MatchCriterion = 'availability'|'intent'|'budget'|'currency'|'location'|'type'|'bedrooms'|'bathrooms'|'area'|'features'|'exclusions'|'timeframe'|'use';
export interface MatchReason { criterion: MatchCriterion; state: 'match'|'missing'|'conflict'; detail: string }
export interface PropertyMatch { contact: AppRecord; property: AppRecord; score: number | null; reasons: MatchReason[]; eligible: boolean; dormant: boolean }
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
export const normalizeMatchText = (v: unknown) => str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const tags = (v: unknown) => [...new Set(str(v).split(/[,;\n]/).map(normalizeMatchText).filter(Boolean))];
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
/** First present value among aliases; the Spanish key always wins. */
const pick = (data: RecordData, ...keys: string[]) => { for (const k of keys) { const v = data[k]; if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
export const currencyOf = (data: RecordData) => { const code=str(pick(data,'moneda','currency')).toUpperCase(); return (CURRENCY_CODES as readonly string[]).includes(code) ? code : ''; };
export const priceOf = (data: RecordData) => num(pick(data,'precio','price','list_price'));
export function propertyOperation(data: RecordData): 'sale'|'rent'|'holiday'|'' {
 const op=normalizeMatchText(pick(data,'operacion','transaction_type','operation_type','listing_type','purpose'));
 if (/^(venta|sale|sell|for sale|purchase)$/.test(op)) return 'sale';
 if (/^(alquiler|rent|rental|lease|for rent|long.term.rental)$/.test(op)) return 'rent';
 if (/turistico|holiday|vacation|short.stay|short.term/.test(op)) return 'holiday';
 return '';
}
const AVAILABLE = /^(disponible|available|active|for sale|for rent)$/;
export function intentOf(data: RecordData): 'sale'|'rent'|'' {
 if ('match_intent' in data && data.match_intent !== 'sale' && data.match_intent !== 'rent') return '';
 if (data.match_intent === 'sale' || data.match_intent === 'rent') return data.match_intent;
 const roles = contactRoles(data);
 if (roles.length) { const buying=roles.some(r=>r==='comprador'||r==='inversor');const renting=roles.includes('arrendatario'); return buying === renting ? '' : renting ? 'rent' : 'sale'; }
 const declared = normalizeMatchText(pick(data,'search_intent','intent','operacion_busca'));
 return /rent|alquil|lease|tenant/.test(declared) ? 'rent' : /buy|purchase|compr|invest|invers/.test(declared) ? 'sale' : '';
}
const validDay = (value: unknown) => { const text=str(value); const stamp=Date.parse(text); return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===text?text:''; };
export function matchProperty(contact: AppRecord, property: AppRecord, now = new Date()): PropertyMatch {
 const c=contact.data,p=property.data; const reasons: MatchReason[]=[];
 const add=(criterion: MatchCriterion,state: MatchReason['state'],detail:string)=>reasons.push({criterion,state,detail});
 const inactive=c.crm_archived===true || ['descartado','perdido'].includes(str(c.temperatura)) || c.estado==='perdido';
 const supported=isMatchContact(contact.entity) && isProperty(property.entity) && !inactive && Boolean(contact.is_sample)===Boolean(property.is_sample);
 const status=str(pick(p,'estado','status'));
 add('availability',AVAILABLE.test(normalizeMatchText(status))?'match':!status?'missing':'conflict',status);
 const intent=intentOf(c);const op=propertyOperation(p);const operation=op==='holiday'?'':op;
 // Owners and sellers are not looking for a property unless they also hold a buyer or tenant role.
 const roles=contactRoles(c);const seeker=!roles.length||roles.some(r=>r==='comprador'||r==='inversor'||r==='arrendatario');
 add('intent',!seeker||op==='holiday'?'conflict':!intent||!operation?'missing':intent===operation?'match':'conflict',`${intent || '?'} / ${operation || '?'}`);
 const currency=currencyOf(c),propertyCurrency=currencyOf(p);
 add('currency',!currency||!propertyCurrency?'missing':currency===propertyCurrency?'match':'conflict',`${currency || '?'} / ${propertyCurrency || '?'}`);
 const budget=num(pick(c,'presupuesto','budget','max_budget','presupuesto_max')),price=priceOf(p);
 add('budget',budget===null||price===null||!currency||currency!==propertyCurrency?'missing':price<=budget?'match':'conflict',budget===null||price===null?'':`${price} / ${budget} ${propertyCurrency}`);
 const zones=tags(pick(c,'zonas','preferred_areas','preferred_location'));const propertyZones=[p.zona,p.ciudad,p.area,p.city,p.location].map(normalizeMatchText).filter(Boolean);
 if(zones.length) add('location',!propertyZones.length?'missing':zones.some(z=>propertyZones.includes(z))?'match':'conflict',str(p.zona)||str(p.ciudad)||str(p.area)||str(p.city));
 const wantedType=str(pick(c,'tipo_deseado','preferred_property_type')),type=str(pick(p,'tipo','property_type'));
 if(wantedType) add('type',!type?'missing':wantedType===type?'match':'conflict',type);
 for(const [criterion,wanted,actual] of [['bedrooms',pick(c,'habitaciones_min','min_bedrooms'),pick(p,'habitaciones','bedrooms')],['bathrooms',pick(c,'match_bathrooms_min','min_bathrooms'),pick(p,'banos','bathrooms')],['area',pick(c,'metros_min','min_area_sqm'),pick(p,'metros','superficie','area_sqm')]] as const){
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
const byScore=(a:PropertyMatch,b:PropertyMatch)=>(b.score??-1)-(a.score??-1)||a.property.id.localeCompare(b.property.id)||a.contact.id.localeCompare(b.contact.id);
/** Bidirectional: a property finds contacts, a contact finds properties. Same engine both ways. */
export function matchesForRecord(record: AppRecord, records: AppRecord[], qualifiedOnly=true): PropertyMatch[] {
 const candidates=isProperty(record.entity)
  ? records.filter(r=>isMatchContact(r.entity)&&(!qualifiedOnly||r.data.match_qualified===true)).map(c=>matchProperty(c,record))
  : isMatchContact(record.entity)?records.filter(r=>isProperty(r.entity)).map(p=>matchProperty(record,p)):[];
 return candidates.filter(m=>m.eligible).sort(byScore);
}
/** Every eligible pair for one market, scored ones first (search and the map). */
export function matchesForMode(records: AppRecord[], mode: 'sale'|'rent', limit=120): PropertyMatch[] {
 const properties=records.filter(r=>isProperty(r.entity)&&propertyOperation(r.data)===mode);
 const contacts=records.filter(r=>isMatchContact(r.entity));
 return contacts.flatMap(c=>properties.map(p=>matchProperty(c,p))).filter(m=>m.eligible&&m.score!==null).sort(byScore).slice(0,limit);
}
