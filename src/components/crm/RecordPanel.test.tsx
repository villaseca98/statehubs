import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecordPanel } from './RecordPanel';
import { composePack } from '@shared/blueprint/modules';
it('keeps one editable form after changing records and exposes linked-record navigation',()=>{
 const blueprint=composePack('ambos','Agency');
 const contact={id:'c',entity:'contacto_inmo',data:{nombre:'Alex'}};
 const deal={id:'d',entity:'operacion',data:{titulo:'Linked deal',contacto:'c'}};
 const onOpen=vi.fn();const onUpdate=vi.fn();
 const props={blueprint,record:contact,records:[contact,deal],titleOf:(id:string)=>id,onUpdate,onOpen,onDelete:vi.fn(),onClose:vi.fn()};
 const {rerender}=render(<RecordPanel {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'Linked deal'}));expect(onOpen).toHaveBeenCalledWith('d');
 rerender(<RecordPanel {...props} record={{...contact,data:{nombre:'Alex updated',crm_lifecycle:'client'}}}/>);
 expect(screen.getAllByLabelText('Nombre *')).toHaveLength(1);
 fireEvent.change(screen.getByLabelText('Nombre *'),{target:{value:'Alex next'}});
 fireEvent.blur(screen.getByLabelText('Nombre *'));
 expect(onUpdate).toHaveBeenCalledWith('c',{nombre:'Alex next'});
});
