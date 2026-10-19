import type { AppRecord, Blueprint } from '@shared/blueprint/types';

export const isProperty = (entity: string) => /^(inmueble|propiedad|property|properties|listing|listings|vivienda|inmueble_inmo)$/i.test(entity);
export type PropertyMarket = 'real-estate' | 'holiday-rentals' | 'uncategorized';
export type PropertyDeal = 'sale' | 'rent';
const str = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function propertyCategory(record: AppRecord): { market: PropertyMarket; deal: PropertyDeal | null } {
 const d = record.data;
 // Operation fields are authoritative; property type and descriptions are not transaction evidence.
 const operation = str(d.operacion || d.transaction_type || d.operation_type || d.listing_type || d.tipo_operacion || d.purpose).toLowerCase();
 const market = str(d.business_mode || d.businessMode || d.rental_type || d.market).toLowerCase();
 const raw = `${operation} ${market}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
 if (/turistico|holiday|vacation|short.term|short.stay|tourist|vacacional/.test(raw)) return { market: 'holiday-rentals', deal: null };
 if (/^(venta|sale|sell|for.sale|purchase)$/.test(operation)) return { market: 'real-estate', deal: 'sale' };
 if (/^(alquiler|rent|rental|lease|for.rent|long.term.rental)$/.test(operation)) return { market: 'real-estate', deal: 'rent' };
 return { market: 'uncategorized', deal: null };
}
export function recordLabel(record: AppRecord, blueprint: Blueprint, fallback: string) {
 const titleField = blueprint.entities.find(e => e.key === record.entity)?.titleField;
 return str(titleField && record.data[titleField]) || str(record.data.direccion || record.data.address || record.data.title || record.data.titulo || record.data.nombre || record.data.name || record.data.huesped || record.data.referencia) || fallback;
}
const PROPERTY_LINKS = ['inmueble', 'alojamiento', 'property_id', 'propertyId', 'inmueble_id', 'listing_id', 'listingId', 'interested_property_id', 'propiedad_id'];
export function linkedToProperty(record: AppRecord, property: AppRecord, blueprint: Blueprint) {
 if (Boolean(record.is_sample) !== Boolean(property.is_sample)) return false;
 const declared = blueprint.entities.find(e => e.key === record.entity)?.fields.filter(f => f.type === 'relation' && f.relation === property.entity).map(f => f.key) ?? [];
 return [...declared, ...PROPERTY_LINKS].some(key => record.data[key] === property.id);
}
export const CONTACT_ENTITY = /^(contacto_inmo|lead|leads|contact|contacts|contacto|contactos|cliente|clientes|buyer|buyers|prospect|prospects)$/i;
export const contactInactive = (r: AppRecord) => r.data.crm_archived === true || ['descartado', 'perdido'].includes(str(r.data.temperatura || r.data.estado));
/** Contacts tied to a property directly or through a viewing, deal, booking or conversation. */
export function linkedContacts(property: AppRecord, records: AppRecord[], blueprint: Blueprint, includeInactive = false) {
 const related = records.filter(r => linkedToProperty(r, property, blueprint));
 const contactIds = new Set<string>();
 for (const r of related) {
  const fields = blueprint.entities.find(e => e.key === r.entity)?.fields.filter(f => f.type === 'relation' && /^(contacto_inmo|lead|cliente|contact|contacto|buyer)$/.test(f.relation ?? '')).map(f => f.key) ?? [];
  for (const key of [...fields, 'contacto', 'contact_id', 'lead', 'lead_id', 'buyer_id']) if (typeof r.data[key] === 'string') contactIds.add(r.data[key] as string);
 }
 return records.filter(r => CONTACT_ENTITY.test(r.entity)
  && (includeInactive || !contactInactive(r))
  && Boolean(r.is_sample) === Boolean(property.is_sample)
  && (linkedToProperty(r, property, blueprint) || contactIds.has(r.id)));
}
export const propertyContacts = (property: AppRecord, records: AppRecord[], blueprint: Blueprint) => linkedContacts(property, records, blueprint);
export function explicitlyQualified(record: AppRecord) {
 // Temperature, a saved match and a successful past deal do not qualify a person.
 if (typeof record.data.match_qualified === 'boolean') return record.data.match_qualified;
 return /^(qualified|cualificado|calificado|sales.ready|sales_ready)$/i.test(str(record.data.qualification_status || record.data.qualification || record.data.estado_calificacion));
}
