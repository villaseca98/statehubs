/**
 * English presentation labels for built-in blueprint sections.
 * Stable blueprint keys remain unchanged because stored CRM records refer to them.
 * User-defined section names are preserved rather than machine-translated.
 */
export const HUB_EN: Readonly<Record<string,string>> = {
  hoy: 'Home', clientes: 'Clients', inmuebles: 'Properties',
  turistico: 'Rentals', empresa: 'Business',
};

const BUILT_IN_SECTIONS: Readonly<Record<string,string>> = {
  hoy: 'Home', panel: 'Overview', centro: 'Operations center',
  analisis: 'Insights', análisis: 'Insights', leads: 'Leads',
  embudo: 'Pipeline', clientes: 'Clients', contactos: 'Contacts',
  contacto_inmo: 'Contacts', inmuebles: 'Properties', propiedades: 'Properties',
  reservas: 'Reservations', alquileres: 'Rentals', calendario: 'Calendar',
  operaciones: 'Deals', operacion: 'Deals', operación: 'Deals',
  tareas: 'Tasks', actividades: 'Activities', agentes: 'Agents',
  equipo: 'Team', facturas: 'Invoices', pagos: 'Payments',
  propietarios: 'Owners', informes: 'Reports', oportunidades: 'Opportunities',
  visitas: 'Viewings', automatizaciones: 'Automations',
  mensajes: 'Messages', negocios: 'Business', servicios: 'Services',
  incidencias: 'Issues', incidencia: 'Issue', mantenimiento: 'Maintenance',
  citas: 'Appointments', cita: 'Appointment', reservas_turisticas: 'Reservations',
  clientes_potenciales: 'Leads', proveedores: 'Providers',
  documentos: 'Documents', contratos: 'Contracts', comisiones: 'Commissions',
  inversiones: 'Investments', proyectos: 'Projects', edificios: 'Buildings',
  unidades: 'Units', propietarios_inmuebles: 'Owners',
};
const normalize = (s: string) => s.trim().toLocaleLowerCase('en-US');

export function englishSectionLabel(key: string, label: string): string {
  return BUILT_IN_SECTIONS[normalize(key)] ?? BUILT_IN_SECTIONS[normalize(label)] ?? label;
}
