import { useI18n } from './index';
const en = {
 title: 'Contact lifecycle', all: 'All contacts', unclassified: 'Unclassified', lead: 'Leads', client: 'Clients', archived: 'Archived',
 convert: 'Convert to client', qualify: 'Mark as lead', archive: 'Archive contact', restore: 'Restore contact',
 help: 'One person, one record. Visits, properties and deals remain linked when you convert or archive.',
 legacy: 'Choose a stage for this existing contact. No stage has been inferred from past activity.',
 roles: 'Relationship roles', primary: 'The primary role comes from the “Es” field below.',
 comprador: 'Buyer', vendedor: 'Seller', propietario: 'Owner', arrendatario: 'Tenant', inversor: 'Investor', huesped: 'Guest', colaborador: 'Partner',
 filter: 'Contact lifecycle filter', empty: 'No contacts in this stage match the current filters.',
};
const es: Record<keyof typeof en, string> = {
 title: 'Ciclo del contacto', all: 'Todos los contactos', unclassified: 'Sin clasificar', lead: 'Leads', client: 'Clientes', archived: 'Archivados',
 convert: 'Convertir en cliente', qualify: 'Marcar como lead', archive: 'Archivar contacto', restore: 'Restaurar contacto',
 help: 'Una persona, una ficha. Sus visitas, inmuebles y operaciones siguen vinculados al convertir o archivar.',
 legacy: 'Elige una etapa para este contacto existente. No se ha deducido de su actividad anterior.',
 roles: 'Roles de la relación', primary: 'El rol principal corresponde al campo «Es» de abajo.',
 comprador: 'Comprador', vendedor: 'Vendedor', propietario: 'Propietario', arrendatario: 'Inquilino', inversor: 'Inversor', huesped: 'Huésped', colaborador: 'Colaborador',
 filter: 'Filtrar por ciclo del contacto', empty: 'No hay contactos de esta etapa que coincidan con los filtros actuales.',
};
export function useContactText() { return useI18n().language === 'es' ? es : en; }
