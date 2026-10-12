import type { AppRecord, Blueprint, SelectOption } from './types.ts';

// Ready-made apps for the public demo and as starting points ("plantillas").
// All names, companies and NIFs are invented.

export interface DemoApp {
  key: string;
  sector: string;
  pitch: string;
  blueprint: Blueprint;
  records: AppRecord[];
}

const opts = (...list: [string, string, SelectOption['color']][]): SelectOption[] =>
  list.map(([value, label, color]) => ({ value, label, color }));

// Lead appointments are relative to today so the demo always has a visit
// today, a missed one and taken slots in the picker.
const rel = (days: number, time: string) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${time}`;
};

const rec = (entity: string, id: string, data: AppRecord['data']): AppRecord => ({ id, entity, data, is_sample: true });

const inmobiliaria: DemoApp = {
  key: 'inmobiliaria',
  sector: 'Inmobiliaria',
  pitch: 'Pisos, compradores y visitas, con el embudo de cada operación.',
  blueprint: {
    version: 1,
    name: 'Aurora Inmobiliaria',
    entities: [
      {
        key: 'lead', label: 'Lead', labelPlural: 'Leads', titleField: 'nombre',
        fields: [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'telefono', label: 'Teléfono', type: 'phone' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'origen', label: 'Origen', type: 'select', options: opts(['portal', 'Portal inmobiliario', 'blue'], ['web', 'Web', 'teal'], ['whatsapp', 'WhatsApp', 'green'], ['recomendacion', 'Recomendación', 'purple'], ['instagram', 'Instagram', 'pink'], ['meta_ads', 'Meta Ads', 'teal']) },
          { key: 'busca', label: 'Busca', type: 'text' },
          { key: 'presupuesto', label: 'Presupuesto', type: 'money' },
          { key: 'estado', label: 'Estado', type: 'select', options: opts(['nuevo', 'Nuevo', 'blue'], ['contactado', 'Contactado', 'amber'], ['visita', 'Visita agendada', 'purple'], ['cualificado', 'Cualificado', 'green'], ['descartado', 'Descartado', 'gray']) },
          { key: 'visita', label: 'Visita', type: 'datetime' },
          { key: 'notas', label: 'Notas', type: 'longtext' },
        ],
      },
      {
        key: 'operacion', label: 'Operación', labelPlural: 'Operaciones', titleField: 'titulo',
        fields: [
          { key: 'titulo', label: 'Operación', type: 'text', required: true },
          { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
          { key: 'inmueble', label: 'Inmueble', type: 'relation', relation: 'inmueble' },
          { key: 'etapa', label: 'Etapa', type: 'select', options: opts(['contacto', 'Primer contacto', 'gray'], ['visita', 'Visita', 'blue'], ['oferta', 'Oferta', 'amber'], ['arras', 'Arras', 'purple'], ['firmada', 'Firmada', 'green'], ['perdida', 'Perdida', 'red']) },
          { key: 'importe', label: 'Importe', type: 'money' },
          { key: 'comision', label: 'Comisión', type: 'percent' },
          { key: 'proxima_visita', label: 'Próxima visita', type: 'date' },
        ],
      },
      {
        key: 'cliente', label: 'Cliente', labelPlural: 'Clientes', titleField: 'nombre',
        fields: [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'telefono', label: 'Teléfono', type: 'phone' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'tipo', label: 'Busca', type: 'select', options: opts(['compra', 'Comprar', 'blue'], ['alquiler', 'Alquilar', 'teal'], ['venta', 'Vender', 'pink']) },
          { key: 'presupuesto', label: 'Presupuesto', type: 'money' },
        ],
      },
      {
        key: 'inmueble', label: 'Inmueble', labelPlural: 'Inmuebles', titleField: 'direccion',
        fields: [
          { key: 'direccion', label: 'Dirección', type: 'text', required: true },
          { key: 'zona', label: 'Zona', type: 'select', options: opts(['centro', 'Centro', 'blue'], ['ensanche', 'Ensanche', 'purple'], ['playa', 'Playa', 'teal'], ['afueras', 'Afueras', 'gray']) },
          { key: 'precio', label: 'Precio', type: 'money' },
          { key: 'metros', label: 'Metros', type: 'number' },
          { key: 'habitaciones', label: 'Habitaciones', type: 'number' },
          { key: 'disponible', label: 'Disponible', type: 'boolean' },
        ],
      },
    ],
    views: [
      {
        key: 'leads', label: 'Leads', type: 'worklist', entity: 'lead', groupBy: 'estado', columns: ['busca', 'presupuesto', 'origen', 'visita'],
        actions: [
          { kind: 'call', label: 'Llamar', field: 'telefono', when: ['nuevo', 'contactado'] },
          { kind: 'schedule', label: 'Agendar visita', field: 'visita', to: 'visita', when: ['nuevo', 'contactado'] },
          { kind: 'whatsapp', label: 'WhatsApp', field: 'telefono' },
          { kind: 'move', label: 'Marcar contactado', to: 'contactado', when: ['nuevo'] },
          { kind: 'move', label: 'Cualificar', to: 'cualificado', when: ['visita'] },
          { kind: 'schedule', label: 'Cambiar la visita', field: 'visita', when: ['visita'] },
          { kind: 'email', label: 'Enviar propuesta', field: 'email', when: ['cualificado'] },
          { kind: 'move', label: 'Descartar', to: 'descartado', when: ['nuevo', 'contactado', 'visita'] },
          { kind: 'move', label: 'Recuperar', to: 'contactado', when: ['descartado'] },
        ],
        availability: { days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '19:00', slotMinutes: 60, breakFrom: '14:00', breakTo: '16:00' },
      },
      { key: 'embudo', label: 'Embudo', type: 'kanban', entity: 'operacion', groupBy: 'etapa', sumField: 'importe' },
      { key: 'visitas', label: 'Visitas', type: 'calendar', entity: 'operacion', dateField: 'proxima_visita' },
      { key: 'clientes', label: 'Clientes', type: 'table', entity: 'cliente', columns: ['nombre', 'telefono', 'tipo', 'presupuesto'] },
      { key: 'inmuebles', label: 'Inmuebles', type: 'table', entity: 'inmueble', columns: ['direccion', 'zona', 'precio', 'metros', 'habitaciones', 'disponible'] },
      { key: 'resumen', label: 'Resumen', type: 'dashboard', widgets: [
        { kind: 'metric', label: 'Operaciones abiertas', entity: 'operacion', agg: 'count' },
        { kind: 'metric', label: 'Volumen en juego', entity: 'operacion', agg: 'sum', field: 'importe' },
        { kind: 'metric', label: 'Precio medio en cartera', entity: 'inmueble', agg: 'avg', field: 'precio' },
        { kind: 'bars', label: 'Importe por etapa', entity: 'operacion', agg: 'sum', field: 'importe', groupBy: 'etapa' },
      ] },
    ],
  },
  records: [
    rec('lead', 'l1', { nombre: 'Sergio Blasco', telefono: '611 908 432', email: 'sblasco@correo.es', origen: 'portal', busca: 'Piso 3 hab. en el centro', presupuesto: 260000, estado: 'nuevo' }),
    rec('lead', 'l2', { nombre: 'Irene Campos', telefono: '+34 677 120 455', origen: 'whatsapp', busca: 'Alquiler cerca de la playa', presupuesto: 1100, estado: 'contactado', notas: 'Prefiere por la tarde.' }),
    rec('lead', 'l3', { nombre: 'Familia Navarro', telefono: '622 554 019', email: 'navarro.fam@correo.es', origen: 'web', busca: 'Casa con jardín', presupuesto: 390000, estado: 'visita', visita: rel(0, '18:00') }),
    rec('lead', 'l4', { nombre: 'David Roig', telefono: '690 333 781', origen: 'recomendacion', busca: 'Local comercial', presupuesto: 180000, estado: 'visita', visita: rel(-1, '11:00') }),
    rec('lead', 'l5', { nombre: 'Paula Esteve', telefono: '644 210 998', email: 'paula.esteve@correo.es', origen: 'portal', busca: 'Ático en el Ensanche', presupuesto: 320000, estado: 'cualificado', visita: rel(-3, '10:00') }),
    rec('lead', 'l6', { nombre: 'Óscar Mena', telefono: '655 001 276', origen: 'web', busca: 'Inversión, piso pequeño', presupuesto: 120000, estado: 'nuevo', visita: rel(1, '10:00') }),
    rec('lead', 'l7', { nombre: 'Laura Gimeno', telefono: '633 870 145', origen: 'portal', busca: 'Alquiler 2 hab.', presupuesto: 850, estado: 'descartado' }),
    rec('lead', 'l8', { nombre: 'Claudia Martín', telefono: '633 410 825', email: 'claudia.martin@correo.es', origen: 'instagram', busca: 'Chalet con piscina en zona residencial', presupuesto: 520000, estado: 'cualificado', notas: 'Ha llegado por Instagram. Quiere concertar visita esta semana.' }),
    rec('lead', 'l9', { nombre: 'Álvaro Serrano', telefono: '644 732 190', origen: 'meta_ads', busca: 'Piso para inversión', presupuesto: 185000, estado: 'nuevo', notas: 'Lead de campaña de Meta Ads. Pendiente primer contacto.' }),
    rec('cliente', 'c1', { nombre: 'Lucía Ferrer', telefono: '612 345 678', email: 'lucia.ferrer@correo.es', tipo: 'compra', presupuesto: 240000 }),
    rec('cliente', 'c2', { nombre: 'Javier Molina', telefono: '622 118 940', email: 'jmolina@correo.es', tipo: 'alquiler', presupuesto: 950 }),
    rec('cliente', 'c3', { nombre: 'Marta y Pablo Ruiz', telefono: '699 402 117', tipo: 'compra', presupuesto: 310000 }),
    rec('cliente', 'c4', { nombre: 'Antonio Gil', telefono: '655 870 233', tipo: 'venta' }),
    rec('inmueble', 'i1', { direccion: 'C/ Colón 14, 3.º B', zona: 'centro', precio: 235000, metros: 92, habitaciones: 3, disponible: true }),
    rec('inmueble', 'i2', { direccion: 'Av. del Puerto 201, 5.º', zona: 'playa', precio: 298000, metros: 110, habitaciones: 3, disponible: true }),
    rec('inmueble', 'i3', { direccion: 'C/ Sueca 8, bajo', zona: 'ensanche', precio: 950, metros: 70, habitaciones: 2, disponible: true }),
    rec('inmueble', 'i4', { direccion: 'Camí Vell 3', zona: 'afueras', precio: 420000, metros: 210, habitaciones: 5, disponible: false }),
    rec('operacion', 'o1', { titulo: 'Lucía · piso Colón', cliente: 'c1', inmueble: 'i1', etapa: 'oferta', importe: 228000, comision: 3, proxima_visita: '2026-10-14' }),
    rec('operacion', 'o2', { titulo: 'Javier · alquiler Sueca', cliente: 'c2', inmueble: 'i3', etapa: 'visita', importe: 11400, comision: 8, proxima_visita: '2026-10-13' }),
    rec('operacion', 'o3', { titulo: 'Ruiz · ático Puerto', cliente: 'c3', inmueble: 'i2', etapa: 'arras', importe: 292000, comision: 3, proxima_visita: '2026-10-20' }),
    rec('operacion', 'o4', { titulo: 'Gil · venta Camí Vell', cliente: 'c4', inmueble: 'i4', etapa: 'firmada', importe: 410000, comision: 2.5 }),
    rec('operacion', 'o5', { titulo: 'Lucía · segunda opción', cliente: 'c1', etapa: 'contacto', importe: 240000, proxima_visita: '2026-10-22' }),
  ],
};

const clinica: DemoApp = {
  key: 'clinica',
  sector: 'Clínica',
  pitch: 'Pacientes, citas y tratamientos, pensado para quien vende por WhatsApp.',
  blueprint: {
    version: 1,
    name: 'Clínica Dental Mar',
    entities: [
      {
        key: 'paciente', label: 'Paciente', labelPlural: 'Pacientes', titleField: 'nombre',
        fields: [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'telefono', label: 'WhatsApp', type: 'phone', required: true },
          { key: 'nif', label: 'DNI', type: 'nif' },
          { key: 'origen', label: 'Cómo nos conoció', type: 'select', options: opts(['google', 'Google', 'blue'], ['instagram', 'Instagram', 'pink'], ['recomendacion', 'Recomendación', 'green'], ['otro', 'Otro', 'gray']) },
          { key: 'estado', label: 'Estado', type: 'select', options: opts(['nuevo', 'Nuevo', 'blue'], ['presupuesto', 'Presupuesto enviado', 'amber'], ['tratamiento', 'En tratamiento', 'purple'], ['alta', 'Alta', 'green']) },
          { key: 'notas', label: 'Notas', type: 'longtext' },
        ],
      },
      {
        key: 'cita', label: 'Cita', labelPlural: 'Citas', titleField: 'motivo',
        fields: [
          { key: 'motivo', label: 'Motivo', type: 'text', required: true },
          { key: 'paciente', label: 'Paciente', type: 'relation', relation: 'paciente' },
          { key: 'fecha', label: 'Fecha', type: 'date', required: true },
          { key: 'confirmada', label: 'Confirmada', type: 'boolean' },
        ],
      },
      {
        key: 'tratamiento', label: 'Tratamiento', labelPlural: 'Tratamientos', titleField: 'nombre',
        fields: [
          { key: 'nombre', label: 'Tratamiento', type: 'text', required: true },
          { key: 'paciente', label: 'Paciente', type: 'relation', relation: 'paciente' },
          { key: 'importe', label: 'Importe', type: 'money' },
          { key: 'estado', label: 'Estado', type: 'select', options: opts(['propuesto', 'Propuesto', 'amber'], ['aceptado', 'Aceptado', 'blue'], ['hecho', 'Hecho', 'green'], ['rechazado', 'Rechazado', 'red']) },
        ],
      },
    ],
    views: [
      { key: 'pacientes', label: 'Pacientes', type: 'table', entity: 'paciente', columns: ['nombre', 'telefono', 'estado', 'origen'] },
      { key: 'agenda', label: 'Agenda', type: 'calendar', entity: 'cita', dateField: 'fecha' },
      { key: 'presupuestos', label: 'Presupuestos', type: 'kanban', entity: 'tratamiento', groupBy: 'estado', sumField: 'importe' },
      { key: 'panel', label: 'Panel', type: 'dashboard', widgets: [
        { kind: 'metric', label: 'Pacientes', entity: 'paciente', agg: 'count' },
        { kind: 'metric', label: 'Presupuestado', entity: 'tratamiento', agg: 'sum', field: 'importe' },
        { kind: 'bars', label: 'Pacientes por origen', entity: 'paciente', agg: 'count', groupBy: 'origen' },
      ] },
    ],
  },
  records: [
    rec('paciente', 'p1', { nombre: 'Carmen López', telefono: '611 222 333', nif: '12345678Z', origen: 'google', estado: 'tratamiento', notas: 'Prefiere citas por la tarde.' }),
    rec('paciente', 'p2', { nombre: 'Raúl Navarro', telefono: '644 555 120', origen: 'instagram', estado: 'presupuesto' }),
    rec('paciente', 'p3', { nombre: 'Elena Soler', telefono: '633 908 771', origen: 'recomendacion', estado: 'nuevo' }),
    rec('paciente', 'p4', { nombre: 'Miguel Ortega', telefono: '688 410 552', origen: 'google', estado: 'alta' }),
    rec('cita', 'ci1', { motivo: 'Revisión', paciente: 'p3', fecha: '2026-10-13', confirmada: true }),
    rec('cita', 'ci2', { motivo: 'Implante: 2.ª fase', paciente: 'p1', fecha: '2026-10-15', confirmada: true }),
    rec('cita', 'ci3', { motivo: 'Valoración ortodoncia', paciente: 'p2', fecha: '2026-10-16', confirmada: false }),
    rec('tratamiento', 't1', { nombre: 'Implante pieza 36', paciente: 'p1', importe: 1150, estado: 'aceptado' }),
    rec('tratamiento', 't2', { nombre: 'Ortodoncia invisible', paciente: 'p2', importe: 3200, estado: 'propuesto' }),
    rec('tratamiento', 't3', { nombre: 'Blanqueamiento', paciente: 'p4', importe: 290, estado: 'hecho' }),
    rec('tratamiento', 't4', { nombre: 'Limpieza', paciente: 'p3', importe: 60, estado: 'propuesto' }),
  ],
};

const distribucion: DemoApp = {
  key: 'distribucion',
  sector: 'Distribución (ERP)',
  pitch: 'Clientes, productos, pedidos y facturas con IVA, para un almacén pequeño.',
  blueprint: {
    version: 1,
    name: 'Distribuciones Levante',
    entities: [
      {
        key: 'pedido', label: 'Pedido', labelPlural: 'Pedidos', titleField: 'numero',
        fields: [
          { key: 'numero', label: 'N.º pedido', type: 'text', required: true },
          { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
          { key: 'fecha_entrega', label: 'Entrega', type: 'date' },
          { key: 'estado', label: 'Estado', type: 'select', options: opts(['borrador', 'Borrador', 'gray'], ['confirmado', 'Confirmado', 'blue'], ['preparando', 'Preparando', 'amber'], ['enviado', 'Enviado', 'purple'], ['entregado', 'Entregado', 'green']) },
          { key: 'base', label: 'Base imponible', type: 'money' },
          { key: 'iva', label: 'IVA', type: 'select', options: opts(['21', '21 %', 'blue'], ['10', '10 %', 'teal'], ['4', '4 %', 'green']) },
        ],
      },
      {
        key: 'cliente', label: 'Cliente', labelPlural: 'Clientes', titleField: 'razon_social',
        fields: [
          { key: 'razon_social', label: 'Razón social', type: 'text', required: true },
          { key: 'nif', label: 'CIF', type: 'nif', required: true },
          { key: 'provincia', label: 'Provincia', type: 'select', options: opts(['valencia', 'Valencia', 'blue'], ['alicante', 'Alicante', 'teal'], ['castellon', 'Castellón', 'amber'], ['murcia', 'Murcia', 'pink']) },
          { key: 'telefono', label: 'Teléfono', type: 'phone' },
          { key: 'credito', label: 'Límite de crédito', type: 'money' },
        ],
      },
      {
        key: 'producto', label: 'Producto', labelPlural: 'Productos', titleField: 'nombre',
        fields: [
          { key: 'referencia', label: 'Referencia', type: 'text' },
          { key: 'nombre', label: 'Producto', type: 'text', required: true },
          { key: 'familia', label: 'Familia', type: 'select', options: opts(['bebidas', 'Bebidas', 'blue'], ['conservas', 'Conservas', 'amber'], ['limpieza', 'Limpieza', 'teal']) },
          { key: 'precio', label: 'Precio', type: 'money' },
          { key: 'stock', label: 'Stock', type: 'number' },
        ],
      },
      {
        key: 'factura', label: 'Factura', labelPlural: 'Facturas', titleField: 'numero',
        fields: [
          { key: 'numero', label: 'N.º factura', type: 'text', required: true },
          { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
          { key: 'fecha', label: 'Fecha', type: 'date' },
          { key: 'base', label: 'Base imponible', type: 'money' },
          { key: 'total', label: 'Total con IVA', type: 'money' },
          { key: 'cobro', label: 'Cobro', type: 'select', options: opts(['pendiente', 'Pendiente', 'amber'], ['cobrada', 'Cobrada', 'green'], ['vencida', 'Vencida', 'red']) },
        ],
      },
    ],
    views: [
      { key: 'inicio', label: 'Inicio', type: 'dashboard', widgets: [
        { kind: 'metric', label: 'Pedidos', entity: 'pedido', agg: 'count' },
        { kind: 'metric', label: 'Facturado', entity: 'factura', agg: 'sum', field: 'total' },
        { kind: 'metric', label: 'Unidades en stock', entity: 'producto', agg: 'sum', field: 'stock' },
        { kind: 'bars', label: 'Pedidos por estado', entity: 'pedido', agg: 'count', groupBy: 'estado' },
        { kind: 'bars', label: 'Facturas por cobro', entity: 'factura', agg: 'sum', field: 'total', groupBy: 'cobro' },
      ] },
      { key: 'pedidos', label: 'Pedidos', type: 'kanban', entity: 'pedido', groupBy: 'estado', sumField: 'base' },
      { key: 'facturas', label: 'Facturas', type: 'table', entity: 'factura', columns: ['numero', 'cliente', 'fecha', 'base', 'total', 'cobro'] },
      { key: 'clientes', label: 'Clientes', type: 'table', entity: 'cliente', columns: ['razon_social', 'nif', 'provincia', 'telefono', 'credito'] },
      { key: 'productos', label: 'Productos', type: 'table', entity: 'producto', columns: ['referencia', 'nombre', 'familia', 'precio', 'stock'] },
      { key: 'entregas', label: 'Entregas', type: 'calendar', entity: 'pedido', dateField: 'fecha_entrega' },
    ],
  },
  records: [
    rec('cliente', 'cl1', { razon_social: 'Bar Restaurante La Lonja SL', nif: 'B12345674', provincia: 'valencia', telefono: '961 234 567', credito: 3000 }),
    rec('cliente', 'cl2', { razon_social: 'Supermercados Costa Blanca SA', nif: 'A03456781', provincia: 'alicante', telefono: '965 112 233', credito: 15000 }),
    rec('cliente', 'cl3', { razon_social: 'Hotel Azahar SL', nif: 'B12987650', provincia: 'castellon', telefono: '964 778 120', credito: 8000 }),
    rec('producto', 'pr1', { referencia: 'BEB-001', nombre: 'Agua mineral 1,5 l (pack 6)', familia: 'bebidas', precio: 2.4, stock: 840 }),
    rec('producto', 'pr2', { referencia: 'CON-014', nombre: 'Atún en aceite (pack 3)', familia: 'conservas', precio: 3.9, stock: 310 }),
    rec('producto', 'pr3', { referencia: 'LIM-120', nombre: 'Lavavajillas industrial 5 l', familia: 'limpieza', precio: 11.5, stock: 64 }),
    rec('producto', 'pr4', { referencia: 'BEB-027', nombre: 'Horchata 1 l', familia: 'bebidas', precio: 1.8, stock: 0 }),
    rec('pedido', 'pe1', { numero: 'P-2026-0412', cliente: 'cl1', fecha_entrega: '2026-10-13', estado: 'preparando', base: 486.5, iva: '10' }),
    rec('pedido', 'pe2', { numero: 'P-2026-0413', cliente: 'cl2', fecha_entrega: '2026-10-14', estado: 'confirmado', base: 3120, iva: '10' }),
    rec('pedido', 'pe3', { numero: 'P-2026-0414', cliente: 'cl3', fecha_entrega: '2026-10-16', estado: 'borrador', base: 940, iva: '21' }),
    rec('pedido', 'pe4', { numero: 'P-2026-0409', cliente: 'cl2', fecha_entrega: '2026-10-09', estado: 'entregado', base: 2210, iva: '10' }),
    rec('pedido', 'pe5', { numero: 'P-2026-0410', cliente: 'cl1', fecha_entrega: '2026-10-10', estado: 'enviado', base: 312, iva: '21' }),
    rec('factura', 'f1', { numero: 'F-2026-0201', cliente: 'cl2', fecha: '2026-10-09', base: 2210, total: 2431, cobro: 'pendiente' }),
    rec('factura', 'f2', { numero: 'F-2026-0198', cliente: 'cl1', fecha: '2026-09-30', base: 520, total: 572, cobro: 'cobrada' }),
    rec('factura', 'f3', { numero: 'F-2026-0187', cliente: 'cl3', fecha: '2026-09-12', base: 1300, total: 1573, cobro: 'vencida' }),
  ],
};

const agencia: DemoApp = {
  key: 'agencia',
  sector: 'Agencia',
  pitch: 'Clientes, proyectos y horas para una agencia de marketing.',
  blueprint: {
    version: 1,
    name: 'Estudio Brisa',
    entities: [
      {
        key: 'proyecto', label: 'Proyecto', labelPlural: 'Proyectos', titleField: 'nombre',
        fields: [
          { key: 'nombre', label: 'Proyecto', type: 'text', required: true },
          { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
          { key: 'estado', label: 'Estado', type: 'select', options: opts(['propuesta', 'Propuesta', 'gray'], ['en_curso', 'En curso', 'amber'], ['revision', 'En revisión', 'purple'], ['hecho', 'Hecho', 'green'], ['bloqueado', 'Bloqueado', 'red']) },
          { key: 'presupuesto', label: 'Presupuesto', type: 'money' },
          { key: 'entrega', label: 'Entrega', type: 'date' },
          { key: 'avance', label: 'Avance', type: 'percent' },
        ],
      },
      {
        key: 'cliente', label: 'Cliente', labelPlural: 'Clientes', titleField: 'empresa',
        fields: [
          { key: 'empresa', label: 'Empresa', type: 'text', required: true },
          { key: 'contacto', label: 'Contacto', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'web', label: 'Web', type: 'url' },
          { key: 'cuota', label: 'Cuota mensual', type: 'money' },
        ],
      },
    ],
    views: [
      { key: 'proyectos', label: 'Proyectos', type: 'table', entity: 'proyecto', columns: ['nombre', 'cliente', 'estado', 'presupuesto', 'entrega', 'avance'] },
      { key: 'tablero', label: 'Tablero', type: 'kanban', entity: 'proyecto', groupBy: 'estado', sumField: 'presupuesto' },
      { key: 'entregas', label: 'Entregas', type: 'calendar', entity: 'proyecto', dateField: 'entrega' },
      { key: 'clientes', label: 'Clientes', type: 'table', entity: 'cliente', columns: ['empresa', 'contacto', 'email', 'cuota'] },
    ],
  },
  records: [
    rec('cliente', 'a1', { empresa: 'Panadería Hermanos Vidal', contacto: 'Rosa Vidal', email: 'rosa@hvidal.es', web: 'https://hvidal.es', cuota: 450 }),
    rec('cliente', 'a2', { empresa: 'Gimnasio Forma', contacto: 'Iván Cano', email: 'ivan@formagym.es', cuota: 900 }),
    rec('cliente', 'a3', { empresa: 'Bodegas Alto Turia', contacto: 'Nuria Peris', email: 'nuria@altoturia.es', cuota: 1200 }),
    rec('proyecto', 'pj1', { nombre: 'Web nueva y reservas', cliente: 'a2', estado: 'en_curso', presupuesto: 3800, entrega: '2026-10-24', avance: 60 }),
    rec('proyecto', 'pj2', { nombre: 'Campaña vendimia', cliente: 'a3', estado: 'revision', presupuesto: 2400, entrega: '2026-10-15', avance: 90 }),
    rec('proyecto', 'pj3', { nombre: 'Reels de octubre', cliente: 'a1', estado: 'hecho', presupuesto: 600, entrega: '2026-10-05', avance: 100 }),
    rec('proyecto', 'pj4', { nombre: 'Tienda online', cliente: 'a1', estado: 'propuesta', presupuesto: 5200, entrega: '2026-11-20', avance: 0 }),
    rec('proyecto', 'pj5', { nombre: 'Fotos de producto', cliente: 'a3', estado: 'bloqueado', presupuesto: 900, entrega: '2026-10-18', avance: 30 }),
  ],
};

export const DEMO_APPS: DemoApp[] = [inmobiliaria, clinica, distribucion, agencia];
