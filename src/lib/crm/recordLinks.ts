import type { AppRecord, Blueprint } from '@shared/blueprint/types';
// Only declared relations and records already authorized by the workspace are used.
export function linkedRecords(blueprint: Blueprint, record: AppRecord, records: AppRecord[]) {
 const entities = new Map(blueprint.entities.map(e=>[e.key,e]));
 const outgoing = (source: AppRecord) => {
  const fields = entities.get(source.entity)?.fields.filter(f=>f.type==='relation') ?? [];
  return records.filter(target => fields.some(f=>f.relation===target.entity && source.data[f.key]===target.id));
 };
 const incoming = records.filter(source => source.id!==record.id && (entities.get(source.entity)?.fields ?? []).some(f=>f.type==='relation' && f.relation===record.entity && source.data[f.key]===record.id));
 const direct = [...outgoing(record),...incoming];
 // Properties referenced by the contact's own deals/visits belong in the dossier too.
 const properties = ['contacto_inmo','cliente','lead'].includes(record.entity) ? incoming.flatMap(source=>outgoing(source).filter(r=>['inmueble','alojamiento'].includes(r.entity))) : [];
 const unique = [...new Map([...direct,...properties].filter(r=>r.id!==record.id).map(r=>[r.id,r])).values()];
 return blueprint.entities.map(entity=>({entity,records:unique.filter(r=>r.entity===entity.key)})).filter(group=>group.records.length);
}
