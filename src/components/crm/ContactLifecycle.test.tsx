import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { AppRecord } from '@shared/blueprint/types';
import { ContactLifecycle } from './ContactLifecycle';
import { contactRoles, contactStage, contactStagePatch } from '@/lib/crm/contactLifecycle';
const contact: AppRecord = { id: 'contact-1', entity: 'contacto_inmo', data: { nombre: 'Alex', tipo: 'propietario', notas: 'Keep notes' } };
function Harness() {
 const [record, setRecord] = useState(contact);
 return <ContactLifecycle record={record} readOnly={false} onUpdate={(id, patch) => { expect(id).toBe(contact.id); setRecord(r => ({ ...r, data: { ...r.data, ...patch } })); }} />;
}
describe('contact lifecycle', () => {
 it('does not infer customers from legacy closed stages', () => {
  expect(contactStage({ temperatura: 'cerrado' })).toBe('unclassified');
 });
 it('converts without replacing the identity and restores the previous stage', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Convert to client' }));
  expect(screen.getByRole('status')).toHaveTextContent('Clients');
  expect(screen.queryByRole('button', { name: 'Convert to client' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Archive contact' }));
  expect(screen.getByRole('status')).toHaveTextContent('Archived');
  fireEvent.click(screen.getByRole('button', { name: 'Restore contact' }));
  expect(screen.getByRole('status')).toHaveTextContent('Clients');
 });
 it('allows multiple roles without rewriting the primary role', () => {
  render(<Harness />);
  expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Buyer' }));
  expect(screen.getByRole('checkbox', { name: 'Buyer' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Owner' })).toBeChecked();
 });
 it('does not offer mutation controls to viewers', () => {
  const update = vi.fn();
  render(<ContactLifecycle record={contact} readOnly onUpdate={update} />);
  expect(screen.queryByRole('button')).toBeNull();
  for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  expect(update).not.toHaveBeenCalled();
 });
 it('keeps unrelated data when applying repeat conversion patches', () => {
  const data = { ...contact.data, ...contactStagePatch('client'), ...contactStagePatch('client') };
  expect(data.notas).toBe('Keep notes');
  expect(contactRoles(data)).toEqual(['propietario']);
  expect(contactStage(data)).toBe('client');
 });
});
