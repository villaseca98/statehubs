import { expect, it } from 'vitest';
import { composePack } from '@shared/blueprint/modules';
import type { AppRecord } from '@shared/blueprint/types';
import { linkedRecords } from './recordLinks';
it('follows declared incoming/outgoing links and includes properties through deals without duplicates', () => {
 const blueprint=composePack('ambos','Agency');
 const contact: AppRecord={id:'c',entity:'contacto_inmo',data:{nombre:'Alex'}};
 const records: AppRecord[]=[contact,{id:'p',entity:'inmueble',data:{titulo:'Home'}},{id:'d',entity:'operacion',data:{contacto:'c',inmueble:'p'}},{id:'v',entity:'cita_inmo',data:{contacto:'c',inmueble:'p'}},{id:'unrelated',entity:'operacion',data:{notas:'c'}},{id:'wrong-type',entity:'persona',data:{}}];
 const groups=linkedRecords(blueprint,contact,records);
 expect(groups.flatMap(g=>g.records.map(r=>r.id)).sort()).toEqual(['d','p','v']);
 expect(linkedRecords(blueprint,records[2],records).flatMap(g=>g.records.map(r=>r.id)).sort()).toEqual(['c','p']);
});
it('does not expose unavailable or wrong-entity targets', () => {
 const blueprint=composePack('ambos','Agency');
 const deal: AppRecord={id:'d',entity:'operacion',data:{contacto:'c',inmueble:'missing'}};
 expect(linkedRecords(blueprint,deal,[deal,{id:'c',entity:'persona',data:{}}])).toEqual([]);
});
