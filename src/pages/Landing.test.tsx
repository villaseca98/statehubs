import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Landing from './Landing';

vi.mock('@/lib/useAuth',()=>({useAuth:()=>({user:null,loading:false})}));
vi.mock('@/components/crm/ScrollHero',()=>({ScrollHero:()=>null}));
vi.mock('@/lib/crm/localApi',()=>({localCrmApi:{listApps:vi.fn().mockResolvedValue([])}}));
function Destination(){const location=useLocation();return <p data-testid="destination">{location.pathname+location.search}</p>}
describe('Landing onboarding entry points',()=>{
 beforeEach(()=>localStorage.clear());
 it('offers three business models and sends guests to registration with their choice preserved',()=>{
  render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Landing/>}/><Route path="/register" element={<Destination/>}/></Routes></MemoryRouter>);
  const buttons=screen.getAllByRole('button',{name:/Empezar con/i});
  expect(buttons).toHaveLength(3);
  fireEvent.click(buttons[1]);
  expect(screen.getByTestId('destination').textContent).toContain('/register?next=');
  expect(decodeURIComponent(screen.getByTestId('destination').textContent||'')).toContain('/onboarding?mode=holidays');
 });
});
