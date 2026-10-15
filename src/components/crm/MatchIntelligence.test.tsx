import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { composePack } from '@shared/blueprint/modules';
import { MatchIntelligence } from './MatchIntelligence';
import { RuntimeContext } from './runtimeContext';
const api=vi.hoisted(()=>({matchDecisions:vi.fn(),setMatchDecision:vi.fn()}));
vi.mock('@/lib/crm/api',()=>({crmApi:api}));
vi.mock('@/lib/crm/localApi',()=>({localCrmApi:api,isLocalApp:()=>false}));
const contact={id:'c',entity:'contacto_inmo',data:{nombre:'Buyer',tipo:'comprador',presupuesto:300000,moneda:'EUR'}};
const property={id:'p',entity:'inmueble',data:{direccion:'Home',operacion:'venta',estado:'disponible',precio:200000,moneda:'EUR'}};
const props={appId:'app',record:contact,records:[contact,property],blueprint:composePack('ambos','Agency'),readOnly:false,onUpdate:vi.fn(),onOpen:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();api.matchDecisions.mockResolvedValue([]);api.setMatchDecision.mockResolvedValue({app_id:'app',contact_id:'c',property_id:'p',status:'saved',actor_id:'owner',updated_at:'2026-10-13'});});
it('saves a match only after server acknowledgment and restores it from the saved view',async()=>{
 render(<MatchIntelligence {...props}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Save match'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Save match'}));await waitFor(()=>expect(api.setMatchDecision).toHaveBeenCalledWith('c','p','saved'));
 fireEvent.click(screen.getByRole('button',{name:'Saved shortlist'}));expect(await screen.findByRole('heading',{name:'Buyer → Home'})).toBeInTheDocument();
});
it('preserves the suggestion after a failed save',async()=>{
 api.setMatchDecision.mockRejectedValue(new Error('Denied'));render(<MatchIntelligence {...props}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Save match'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Save match'}));expect(await screen.findByRole('alert')).toHaveTextContent('Denied');expect(screen.getByRole('heading',{name:'Buyer → Home'})).toBeInTheDocument();
});
it('disables decision mutations for viewers',async()=>{
 render(<MatchIntelligence {...props} readOnly/>);await screen.findByRole('heading',{name:'Buyer → Home'});expect(screen.getByRole('button',{name:'Save match'})).toBeDisabled();expect(screen.getByRole('button',{name:'Dismiss'})).toBeDisabled();
});
it('creates a viewing linked to both records using the existing creation path',async()=>{
 const create=vi.fn().mockResolvedValue({id:'viewing'});
 render(<RuntimeContext.Provider value={{canEdit:true,createQuietly:create}}><MatchIntelligence {...props}/></RuntimeContext.Provider>);
 fireEvent.click(screen.getByRole('button',{name:'Schedule viewing'}));
 fireEvent.change(screen.getByLabelText('Viewing date and time (workspace local time)'),{target:{value:'2026-12-01T10:00'}});
 fireEvent.click(screen.getByRole('button',{name:'Create viewing'}));await waitFor(()=>expect(create).toHaveBeenCalledWith('cita_inmo',expect.objectContaining({contacto:'c',inmueble:'p',tipo:'visita',cuando:'2026-12-01T10:00'})));
 expect(await screen.findByText('Viewing created')).toBeInTheDocument();
});
