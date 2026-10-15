import { describe, expect, it } from 'vitest';
import { composePack } from '@shared/blueprint/modules';
import type { AppRecord } from '@shared/blueprint/types';
import { explicitlyQualified, linkedToProperty, propertyCategory, propertyContacts, recordLabel } from './propertyFeed';
const bp = composePack('ambos', 'Agency');
const property: AppRecord = { id: 'property', entity: 'inmueble', data: { direccion: 'Ocean House', operacion: 'venta' } };
describe('property feed uses the persisted CRM schema', () => {
 it('classifies existing operations without guessing from property type or descriptions', () => {
  expect(propertyCategory(property)).toEqual({ market: 'real-estate', deal: 'sale' });
  expect(propertyCategory({ ...property, data: { operacion: 'alquiler' } }).deal).toBe('rent');
  expect(propertyCategory({ ...property, data: { operacion: 'turistico' } }).market).toBe('holiday-rentals');
  expect(propertyCategory({ ...property, entity: 'property', data: { transaction_type: 'rental' } }).deal).toBe('rent');
  expect(propertyCategory({ ...property, data: { tipo: 'holiday house', description: 'for sale' } }).market).toBe('uncategorized');
  expect(recordLabel(property, bp, 'Missing')).toBe('Ocean House');
 });
 it('follows declared and actual property relationships, never arbitrary matching text', () => {
  expect(linkedToProperty({ id: 'booking', entity: 'reserva', data: { alojamiento: property.id } }, property, bp)).toBe(true);
  expect(linkedToProperty({ id: 'booking', entity: 'reserva', data: { huesped: property.id } }, property, bp)).toBe(false);
 });
 it('deduplicates contacts linked through viewings/deals and excludes archived or sample-only contacts', () => {
  const contact = { id: 'contact', entity: 'contacto_inmo', data: { nombre: 'Alex' } };
  const records: AppRecord[] = [contact,
   { id: 'viewing', entity: 'cita_inmo', data: { inmueble: property.id, contacto: contact.id } },
   { id: 'deal', entity: 'operacion', data: { inmueble: property.id, contacto: contact.id } },
   { id: 'archived', entity: 'lead', data: { property_id: property.id, crm_archived: true } },
   { id: 'sample', entity: 'contacto_inmo', is_sample: true, data: { property_id: property.id } },
   { id: 'unrelated', entity: 'contacto_inmo', data: { notas: property.id } },
  ];
  expect(propertyContacts(property, records, bp)).toEqual([contact]);
 });
 it('requires explicit qualification and respects an explicit negative decision', () => {
  expect(explicitlyQualified({ id: 'c', entity: 'contacto_inmo', data: { temperatura: 'caliente', lead_status: 'hot' } })).toBe(false);
  expect(explicitlyQualified({ id: 'c', entity: 'contacto_inmo', data: { match_qualified: true } })).toBe(true);
  expect(explicitlyQualified({ id: 'c', entity: 'contacto_inmo', data: { qualification_status: 'qualified', match_qualified: false } })).toBe(false);
 });
});
