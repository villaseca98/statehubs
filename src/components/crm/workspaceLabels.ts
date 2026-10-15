import type { Language } from '@/i18n';

const hubs: Record<Language, Record<string, string>> = {
  en: { hoy: 'Home', clientes: 'Clients', inmuebles: 'Properties', turistico: 'Rentals', empresa: 'Business' },
  es: { hoy: 'Inicio', clientes: 'Clientes', inmuebles: 'Inmuebles', turistico: 'Alquileres', empresa: 'Empresa' },
};

const sections: Record<Language, Record<string, string>> = {
  en: {
    hoy: 'Home', panel: 'Overview', centro: 'Operations center', analisis: 'Insights',
    leads: 'Leads', embudo: 'Pipeline', clientes: 'Clients', contactos: 'Contacts',
    contacto_inmo: 'Contacts', inmuebles: 'Properties', propiedades: 'Properties',
    reservas: 'Reservations', alquileres: 'Rentals', calendario: 'Calendar',
    operaciones: 'Deals', operacion: 'Deals', tareas: 'Tasks', actividades: 'Activities',
    agentes: 'Agents', equipo: 'Team', facturas: 'Invoices', pagos: 'Payments',
    propietarios: 'Owners', informes: 'Reports', oportunidades: 'Opportunities',
    visitas: 'Viewings', automatizaciones: 'Automations', mensajes: 'Messages',
    negocios: 'Business',
  },
  es: {
    hoy: 'Inicio', panel: 'Resumen', centro: 'Centro de operaciones', analisis: 'Análisis',
    leads: 'Leads', embudo: 'Embudo', clientes: 'Clientes', contactos: 'Contactos',
    contacto_inmo: 'Contactos', inmuebles: 'Inmuebles', propiedades: 'Inmuebles',
    reservas: 'Reservas', alquileres: 'Alquileres', calendario: 'Calendario',
    operaciones: 'Operaciones', operacion: 'Operaciones', tareas: 'Tareas',
    actividades: 'Actividades', agentes: 'Agentes', equipo: 'Equipo',
    facturas: 'Facturas', pagos: 'Pagos', propietarios: 'Propietarios',
    informes: 'Informes', oportunidades: 'Oportunidades', visitas: 'Visitas',
    automatizaciones: 'Automatizaciones', mensajes: 'Mensajes', negocios: 'Empresa',
  },
};

/** Translates presentation labels only; stable blueprint keys and user-defined names are untouched. */
export function workspaceHubLabel(language: Language, key: string, fallback: string): string {
  return hubs[language]?.[key.toLowerCase()] ?? hubs.en[key.toLowerCase()] ?? fallback;
}

export function workspaceSectionLabel(language: Language, key: string, fallback: string): string {
  const id = key.toLowerCase();
  const label = fallback.toLowerCase();
  return sections[language]?.[id] ?? sections[language]?.[label]
    ?? sections.en[id] ?? sections.en[label] ?? fallback;
}
