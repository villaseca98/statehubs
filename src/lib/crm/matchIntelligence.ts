import type { AppRecord } from '@shared/blueprint/types.ts';

export type MatchMode = 'sale' | 'rent';
export type MatchResult = { buyer: AppRecord; property: AppRecord; score: number; reasons: string[]; gaps: string[]; source: string; mode: MatchMode };
const str = (v: unknown) => String(v ?? '').trim().toLowerCase();
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const tokens = (v: unknown) => str(v).split(/[,;/|]+/).map(x => x.trim()).filter(Boolean);
const propertyMode = (r: AppRecord): MatchMode | null => { const value=str(r.data.operacion || r.data.transaction_type || r.data.listing_type || r.data.purpose); return /^(venta|sale|sell|for sale)$/.test(value)?'sale':/^(alquiler|rent|rental|lease|for rent)$/.test(value)?'rent':null; };
const leadMode = (r: AppRecord): MatchMode | null => {
  const kind = str(r.data.operacion_busca || r.data.interes || r.data.search_intent || r.data.intent || r.data.transaction_type || r.data.tipo);
  if (/alquil|arrend|rent/.test(kind)) return 'rent';
  if (/compr|invers|buy|purchase/.test(kind)) return 'sale';
  return null;
};
const interested = (r: AppRecord) => ['comprador', 'inversor', 'arrendatario', 'buyer', 'investor', 'tenant', ''].includes(str(r.data.tipo || r.data.contact_type));
const currencyOf = (r: AppRecord) => str(r.data.moneda || r.data.currency || 'eur').toUpperCase();
const nameOf = (r: AppRecord) => str(r.data.nombre || r.data.name || r.data.usuario || r.data.direccion || r.data.address);
export function matchOpportunities(records: AppRecord[], mode: MatchMode): MatchResult[] {
  const properties = records.filter(r => ['inmueble','property','properties','listing','listings'].includes(r.entity) && propertyMode(r) === mode && !['vendido','alquilado','retirado','reservado','sold','rented','withdrawn','reserved','inactive','archived'].includes(str(r.data.estado || r.data.status)));
  const buyers = records.filter(r => (['contacto_inmo','contact','contacts','buyer','buyers','tenant','tenants'].includes(r.entity) && interested(r)) || ['lead','leads'].includes(r.entity));
  const matches: MatchResult[] = [];
  for (const buyer of buyers) {
    const intent = leadMode(buyer);
    if (intent && intent !== mode) continue;
    const budget = num(buyer.data.presupuesto || buyer.data.presupuesto_max || buyer.data.budget || buyer.data.max_budget);
    const zones = tokens(buyer.data.zonas || buyer.data.zona || buyer.data.preferred_areas || buyer.data.preferred_location);
    const bedrooms = num(buyer.data.habitaciones_min || buyer.data.min_bedrooms);
    const sqm = num(buyer.data.metros_min || buyer.data.min_area_sqm);
    const kind = str(buyer.data.tipo_deseado || buyer.data.preferred_property_type);
    for (const property of properties) {
      if (currencyOf(buyer) !== currencyOf(property)) continue; // Never compare nominal amounts across currencies.
      const reasons: string[] = [], gaps: string[] = [];
      let points = 0, possible = 0;
      const price = num(property.data.precio || property.data.price);
      if (budget && price) { possible += 35; if (price <= budget) { points += 35; reasons.push('Within stated budget'); } else if (price <= budget * 1.1) { points += 15; gaps.push('Slightly above budget'); } else continue; }
      if (zones.length) { possible += 30; const area = str(property.data.zona || property.data.direccion || property.data.area || property.data.address); if (zones.some(z => area.includes(z) || z.includes(area) && area.length > 2)) { points += 30; reasons.push('Preferred location'); } else gaps.push('Different area'); }
      if (bedrooms && num(property.data.habitaciones || property.data.bedrooms)) { possible += 15; if (num(property.data.habitaciones || property.data.bedrooms) >= bedrooms) { points += 15; reasons.push('Bedrooms match'); } else gaps.push('Fewer bedrooms'); }
      if (sqm && num(property.data.metros || property.data.area_sqm)) { possible += 10; if (num(property.data.metros || property.data.area_sqm) >= sqm) { points += 10; reasons.push('Space requirement met'); } else gaps.push('Smaller than requested'); }
      if (kind && str(property.data.tipo || property.data.property_type)) { possible += 10; if (kind === str(property.data.tipo || property.data.property_type)) { points += 10; reasons.push('Property type match'); } else gaps.push('Different property type'); }
      if (!possible) continue; // Never invent compatibility for leads with no usable preferences.
      const score = Math.round(points / possible * 100);
      if (score < 45) continue;
      matches.push({buyer,property,score,reasons,gaps,mode,source:str(buyer.data.origen || buyer.data.fuente_lead || buyer.data.source || 'crm')});
    }
  }
  return matches.sort((a,b)=>b.score-a.score || nameOf(a.buyer).localeCompare(nameOf(b.buyer))).slice(0,120);
}
