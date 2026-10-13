import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordActivity } from './RecordActivity';
import { LIBRARY } from '@shared/blueprint/modules';
const api=vi.hoisted(()=>({recordEvents:vi.fn(),addRecordActivity:vi.fn()}));
vi.mock('@/lib/crm/api',()=>({crmApi:api}));
vi.mock('@/lib/crm/localApi',()=>({isLocalApp:()=>false,localCrmApi:api}));
const record={id:'contact',entity:'contacto_inmo',data:{nombre:'Alex'}};
beforeEach(()=>{vi.clearAllMocks();api.recordEvents.mockResolvedValue([]);});
it('retains a failed activity draft and reuses its request ID on retry',async()=>{
 api.addRecordActivity.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({id:'event',record_id:record.id,kind:'note',body:'Follow up',fields:[],created_at:'2026-10-13T10:00:00Z',actor_id:null});
 render(<RecordActivity appId="app" record={record} entity={LIBRARY.contacto_inmo} readOnly={false}/>);
 await screen.findByText('No recorded activity yet.');
 fireEvent.change(screen.getByLabelText('Activity details'),{target:{value:'Follow up'}});
 fireEvent.click(screen.getByRole('button',{name:'Save activity'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
 expect(screen.getByLabelText('Activity details')).toHaveValue('Follow up');
 fireEvent.click(screen.getByRole('button',{name:'Save activity'}));
 await waitFor(()=>expect(api.addRecordActivity).toHaveBeenCalledTimes(2));
 expect(api.addRecordActivity.mock.calls[0][3]).toBe(api.addRecordActivity.mock.calls[1][3]);
 await waitFor(()=>expect(screen.getByLabelText('Activity details')).toHaveValue(''));
});
it('viewers can read history without a note form',async()=>{
 render(<RecordActivity appId="app" record={record} entity={LIBRARY.contacto_inmo} readOnly/>);
 await screen.findByText('No recorded activity yet.');
 expect(screen.queryByRole('textbox')).toBeNull();
});
