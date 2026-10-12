import type { Field, SelectOption } from './types.ts';

// Sector templates. A sector is the pieces that business starts with plus the
// extra fields ("parámetros") its records need: a sales team qualifies leads
// by company, size, budget and decision maker; an estate agency needs the
// property's reference, m² and energy rating; a warehouse needs EAN, location,
// batch and reorder point. Fields are added to whatever entities the app has,
// now or later, so pieces keep working the same with or without a sector.

export type SectorKind = 'crm' | 'erp';

export interface SectorDef {
  key: string;
  kind: SectorKind;
  name: string;
  icon: string;                              // lucide icon name, resolved in the UI
  pitch: string;
  modules: string[];                         // pieces it starts with
  fields: Record<string, Field[]>;           // extra fields per library entity
  columns?: Record<string, string[]>;        // screen columns that suit the sector better
  samples?: Record<string, Record<string, unknown>>;  // sample values for the extra fields, by sample id
}

const rel = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const opts = (...list: [string, string, SelectOption['color']][]): SelectOption[] =>
  list.map(([value, label, color]) => ({ value, label, color }));

const SECTOR_CLIENTE = opts(['industria', 'Industria', 'blue'], ['servicios', 'Servicios', 'purple'], ['comercio', 'Comercio', 'teal'], ['hosteleria', 'Hostelería', 'amber'], ['construccion', 'Construcción', 'gray'], ['salud', 'Salud', 'green'], ['tecnologia', 'Tecnología', 'pink']);
const TAMANO = opts(['micro', 'Micro (1–9)', 'gray'], ['pequena', 'Pequeña (10–49)', 'blue'], ['mediana', 'Mediana (50–249)', 'purple'], ['grande', 'Grande (250+)', 'green']);
const PLAZO = opts(['mes', 'Este mes', 'red'], ['trimestre', 'Este trimestre', 'amber'], ['semestre', 'Este semestre', 'blue'], ['sin_prisa', 'Sin prisa', 'gray']);
const ORIGEN = opts(['web', 'Web', 'teal'], ['whatsapp', 'WhatsApp', 'green'], ['instagram', 'Instagram', 'pink'], ['meta_ads', 'Meta Ads (Instagram/Facebook)', 'blue'], ['recomendacion', 'Recomendación', 'purple'], ['llamada', 'Llamada', 'blue']);
const comercial: Field = { key: 'comercial', label: 'Comercial', type: 'relation', relation: 'persona' };

export const SECTORS: SectorDef[] = [
  {
    key: 'ventas', kind: 'crm', name: 'Ventas y equipo comercial', icon: 'TrendingUp',
    pitch: 'Cada lead cualificado como en los grandes CRM: empresa, cargo, tamaño, presupuesto, quién decide, plazo, comercial y siguiente paso.',
    modules: ['panel', 'analisis', 'leads', 'embudo', 'agenda', 'clientes', 'presupuestos', 'operaciones'],
    fields: {
      lead: [
        { key: 'empresa', label: 'Empresa', type: 'text' },
        { key: 'cargo', label: 'Cargo', type: 'text' },
        { key: 'sector_cliente', label: 'Sector', type: 'select', options: SECTOR_CLIENTE },
        { key: 'tamano', label: 'Tamaño', type: 'select', options: TAMANO },
        { key: 'necesidad', label: 'Necesidad', type: 'text', help: 'Qué problema quiere resolver, en sus palabras.' },
        { key: 'presupuesto_ok', label: 'Presupuesto', type: 'select', options: opts(['confirmado', 'Confirmado', 'green'], ['por_confirmar', 'Por confirmar', 'amber'], ['no_tiene', 'No tiene', 'red']) },
        { key: 'decisor', label: 'Quién decide', type: 'select', options: opts(['decide', 'Decide él o ella', 'green'], ['influye', 'Influye', 'amber'], ['no_decide', 'No decide', 'gray']) },
        { key: 'plazo', label: 'Plazo de compra', type: 'select', options: PLAZO },
        { ...comercial },
        { key: 'siguiente_paso', label: 'Siguiente paso', type: 'text' },
        { key: 'proximo_contacto', label: 'Próximo contacto', type: 'date' },
        { key: 'campana', label: 'Campaña', type: 'text' },
        { key: 'provincia', label: 'Provincia', type: 'text' },
        { key: 'linkedin', label: 'LinkedIn', type: 'url' },
      ],
      oportunidad: [
        { key: 'tipo_venta', label: 'Tipo', type: 'select', options: opts(['nuevo', 'Cliente nuevo', 'blue'], ['ampliacion', 'Ampliación', 'purple'], ['renovacion', 'Renovación', 'teal']) },
        { ...comercial },
        { key: 'fuente', label: 'Origen', type: 'select', options: ORIGEN },
        { key: 'competidor', label: 'Competidor', type: 'text' },
        { key: 'siguiente_paso', label: 'Siguiente paso', type: 'text' },
        { key: 'motivo', label: 'Motivo de pérdida', type: 'select', options: opts(['precio', 'Precio', 'amber'], ['competencia', 'Competencia', 'red'], ['sin_presupuesto', 'Sin presupuesto', 'gray'], ['sin_decision', 'No se decide', 'purple'], ['no_encaja', 'No encaja', 'blue']) },
      ],
      cliente: [
        { key: 'sector_cliente', label: 'Sector', type: 'select', options: SECTOR_CLIENTE },
        { key: 'tamano', label: 'Tamaño', type: 'select', options: TAMANO },
        { key: 'facturacion', label: 'Facturación anual', type: 'money' },
        { key: 'web', label: 'Web', type: 'url' },
        { key: 'provincia', label: 'Provincia', type: 'text' },
        { ...comercial },
        { key: 'ciclo', label: 'Ciclo de vida', type: 'select', options: opts(['prospecto', 'Prospecto', 'blue'], ['activo', 'Activo', 'green'], ['riesgo', 'En riesgo', 'amber'], ['perdido', 'Perdido', 'gray']) },
      ],
      presupuesto: [
        { ...comercial },
        { key: 'valido_hasta', label: 'Válido hasta', type: 'date' },
        { key: 'descuento', label: 'Descuento', type: 'percent' },
      ],
    },
    columns: {
      leads: ['empresa', 'valor', 'plazo', 'comercial', 'cita'],
      clientes: ['nombre', 'empresa', 'sector_cliente', 'tamano', 'comercial', 'ciclo'],
    },
    samples: {
      'm-l1': { empresa: 'Estética Vidal', cargo: 'Dueña', sector_cliente: 'servicios', tamano: 'micro', presupuesto_ok: 'por_confirmar', decisor: 'decide', plazo: 'trimestre', comercial: 'm-pe-2', siguiente_paso: 'Enviar casos de éxito' },
      'm-l2': { empresa: 'Reformas Ferrer', cargo: 'Gerente', sector_cliente: 'construccion', tamano: 'pequena', presupuesto_ok: 'confirmado', decisor: 'decide', plazo: 'mes', comercial: 'm-pe-2', siguiente_paso: 'Visita a la obra' },
      'm-l3': { empresa: 'Clínica Gil', cargo: 'Directora', sector_cliente: 'salud', tamano: 'pequena', presupuesto_ok: 'confirmado', decisor: 'influye', plazo: 'trimestre', comercial: 'm-pe-1', siguiente_paso: 'Demo con el socio' },
      'm-l4': { empresa: 'Grupo Ruiz Logística', cargo: 'Director de compras', sector_cliente: 'industria', tamano: 'mediana', presupuesto_ok: 'confirmado', decisor: 'decide', plazo: 'mes', comercial: 'm-pe-1', siguiente_paso: 'Cerrar condiciones' },
      'm-l5': { empresa: 'Mas Asesores', sector_cliente: 'servicios', tamano: 'micro', comercial: 'm-pe-1' },
      'm-l6': { empresa: 'Navarro Metal', sector_cliente: 'industria', tamano: 'mediana', comercial: 'm-pe-1' },
      'm-l7': { empresa: 'Gómez Consultores', sector_cliente: 'servicios', tamano: 'pequena', comercial: 'm-pe-1' },
      'm-l8': { empresa: 'Moda Sala', sector_cliente: 'comercio', tamano: 'micro', comercial: 'm-pe-2' },
      'm-l9': { empresa: 'Café Pardo', sector_cliente: 'hosteleria', tamano: 'micro', comercial: 'm-pe-2' },
      'm-l10': { empresa: 'Ortiz Reformas', sector_cliente: 'construccion', tamano: 'micro', comercial: 'm-pe-2' },
      'm-l11': { empresa: 'Esteve Software', sector_cliente: 'tecnologia', tamano: 'pequena', comercial: 'm-pe-1' },
      'm-l12': { empresa: 'Vila Transportes', sector_cliente: 'industria', tamano: 'mediana', comercial: 'm-pe-2' },
      'm-o1': { tipo_venta: 'renovacion', comercial: 'm-pe-1', fuente: 'recomendacion', siguiente_paso: 'Reunión con dirección' },
      'm-o2': { tipo_venta: 'nuevo', comercial: 'm-pe-2', fuente: 'web', siguiente_paso: 'Enviar propuesta revisada' },
      'm-o3': { tipo_venta: 'nuevo', comercial: 'm-pe-2', fuente: 'instagram' },
      'm-o4': { tipo_venta: 'nuevo', comercial: 'm-pe-1', fuente: 'recomendacion' },
      'm-o5': { tipo_venta: 'ampliacion', comercial: 'm-pe-1', fuente: 'recomendacion' },
      'm-o6': { tipo_venta: 'nuevo', comercial: 'm-pe-2', fuente: 'web', competidor: 'Otra agencia local', motivo: 'competencia' },
      'm-o7': { tipo_venta: 'renovacion', comercial: 'm-pe-2', fuente: 'llamada', motivo: 'precio' },
      'm-cl1': { sector_cliente: 'comercio', tamano: 'micro', provincia: 'Valencia', comercial: 'm-pe-2', ciclo: 'activo' },
      'm-cl2': { sector_cliente: 'industria', tamano: 'pequena', facturacion: 1200000, web: 'https://tallersanz.es', provincia: 'Valencia', comercial: 'm-pe-1', ciclo: 'activo' },
      'm-cl3': { sector_cliente: 'servicios', tamano: 'micro', provincia: 'Alicante', comercial: 'm-pe-1', ciclo: 'prospecto' },
      'm-cl4': { sector_cliente: 'hosteleria', tamano: 'micro', provincia: 'Castellón', comercial: 'm-pe-2', ciclo: 'riesgo' },
    },
  },
  {
    key: 'inmobiliaria', kind: 'crm', name: 'Inmobiliaria', icon: 'Building2',
    pitch: 'CRM para equipos inmobiliarios: recibe leads de Instagram, cualifica intención y presupuesto, asigna al agente adecuado y controla cada siguiente paso.',
    modules: ['panel', 'analisis', 'leads', 'inmuebles', 'visitas', 'embudo', 'clientes', 'documentos'],
    fields: {
      lead: [
        { key: 'operacion_busca', label: 'Quiere', type: 'select', options: opts(['comprar', 'Comprar', 'blue'], ['alquilar', 'Alquilar', 'teal'], ['vender', 'Vender su casa', 'pink'], ['alquilar_suya', 'Alquilar la suya', 'purple']) },
        { key: 'tipo_busca', label: 'Tipo', type: 'select', options: opts(['piso', 'Piso', 'blue'], ['casa', 'Casa o chalet', 'green'], ['atico', 'Ático', 'purple'], ['local', 'Local', 'amber'], ['oficina', 'Oficina', 'gray']) },
        { key: 'zona', label: 'Zonas', type: 'text' },
        { key: 'presupuesto_max', label: 'Presupuesto máximo', type: 'money' },
        { key: 'habitaciones_min', label: 'Habitaciones mínimas', type: 'number' },
        { key: 'financiacion', label: 'Financiación', type: 'select', options: opts(['no_necesita', 'No la necesita', 'green'], ['preaprobada', 'Hipoteca preaprobada', 'blue'], ['en_tramite', 'En trámite', 'amber'], ['sin_mirar', 'Sin mirar', 'gray']) },
        { key: 'plazo', label: 'Plazo', type: 'select', options: PLAZO },
        { key: 'siguiente_paso', label: 'Siguiente paso comercial', type: 'text', help: 'La acción concreta que debe ocurrir para avanzar este lead.' },
        { key: 'proximo_contacto', label: 'Próximo seguimiento', type: 'date', help: 'La vista Hoy lo señalará cuando toque o se retrase.' },
        { key: 'prioridad_comercial', label: 'Prioridad comercial', type: 'select', options: opts(['alta', 'Alta', 'red'], ['media', 'Media', 'amber'], ['baja', 'Baja', 'gray']) },
        { key: 'fuente_lead', label: 'Origen del lead', type: 'select', options: opts(['instagram', 'Instagram', 'pink'], ['meta_ads', 'Meta Ads (Instagram/Facebook)', 'blue'], ['web', 'Web', 'teal'], ['portal', 'Portal inmobiliario', 'blue'], ['recomendacion', 'Recomendación', 'purple'], ['llamada', 'Llamada', 'gray'], ['otro', 'Otro', 'gray']) },
        { key: 'instagram_usuario', label: 'Usuario de Instagram', type: 'text', help: 'Nombre de usuario público, si el lead llega desde Instagram.' },
        { key: 'campana_instagram', label: 'Campaña de Instagram', type: 'text' },
        { key: 'estado_cualificacion', label: 'Cualificación', type: 'select', options: opts(['nuevo', 'Nuevo sin revisar', 'gray'], ['pendiente_datos', 'Faltan datos', 'amber'], ['cualificado', 'Cualificado', 'green'], ['no_cualificado', 'No cualificado', 'red']) },
        { key: 'puntuacion_lead', label: 'Puntuación del lead', type: 'number', help: 'Puntuación orientativa basada en los datos disponibles; no sustituye la revisión del agente.' },
        { key: 'contacto_autorizado', label: 'Permiso para contacto comercial', type: 'select', options: opts(['confirmado', 'Confirmado', 'green'], ['pendiente', 'Pendiente de confirmar', 'amber'], ['no', 'No autorizado', 'red']) },
      ],
      oportunidad: [
        { key: 'inmueble', label: 'Inmueble', type: 'relation', relation: 'inmueble' },
        { key: 'tipo_operacion', label: 'Operación', type: 'select', options: opts(['venta', 'Venta', 'blue'], ['alquiler', 'Alquiler', 'teal']) },
        { key: 'comision', label: 'Comisión', type: 'percent' },
        { key: 'siguiente_paso', label: 'Siguiente paso comercial', type: 'text', help: 'La acción concreta pendiente para avanzar hacia el cierre.' },
        { key: 'proximo_contacto', label: 'Próximo seguimiento', type: 'date' },
        { key: 'motivo_perdida', label: 'Motivo de pérdida', type: 'select', options: opts(['precio', 'Precio', 'amber'], ['financiacion', 'Financiación', 'red'], ['eligio_otro', 'Eligió otra propiedad/agencia', 'purple'], ['sin_respuesta', 'Dejó de responder', 'gray'], ['otro', 'Otro', 'blue']) },
      ],
      visita: [
        { key: 'siguiente_paso', label: 'Siguiente paso tras la visita', type: 'text', help: 'Ej.: enviar documentación, llamar al propietario o preparar oferta.' },
        { key: 'proximo_contacto', label: 'Seguimiento tras la visita', type: 'date' },
      ],
      cliente: [
        { key: 'rol', label: 'Es', type: 'select', options: opts(['comprador', 'Comprador', 'blue'], ['propietario', 'Propietario', 'pink'], ['inquilino', 'Inquilino', 'teal'], ['arrendador', 'Arrendador', 'purple']) },
      ],
    },
    columns: {
      leads: ['operacion_busca', 'fuente_lead', 'estado_cualificacion', 'puntuacion_lead', 'zona', 'presupuesto_max', 'financiacion', 'proximo_contacto', 'prioridad_comercial'],
      clientes: ['nombre', 'telefono', 'email', 'rol'],
    },
    samples: {
      'm-l1': { operacion_busca: 'comprar', tipo_busca: 'piso', zona: 'Ruzafa, Ensanche', presupuesto_max: 220000, habitaciones_min: 2, financiacion: 'preaprobada', plazo: 'trimestre', siguiente_paso: 'Confirmar disponibilidad y proponer segunda visita', proximo_contacto: rel(-1), prioridad_comercial: 'alta', fuente_lead: 'instagram', instagram_usuario: '@lucia.vlc', campana_instagram: 'Compradores Valencia · Octubre', estado_cualificacion: 'cualificado', puntuacion_lead: 85, contacto_autorizado: 'confirmado' },
      'm-l2': { operacion_busca: 'alquilar', tipo_busca: 'piso', zona: 'Benimaclet', presupuesto_max: 1100, habitaciones_min: 3, financiacion: 'no_necesita', plazo: 'mes', siguiente_paso: 'Enviar dos opciones que encajen', proximo_contacto: rel(0), prioridad_comercial: 'media', fuente_lead: 'instagram', instagram_usuario: '@hugo.busca.piso', campana_instagram: 'Alquiler Valencia', estado_cualificacion: 'pendiente_datos', puntuacion_lead: 45, contacto_autorizado: 'pendiente' },
      'm-l3': { operacion_busca: 'vender', tipo_busca: 'atico', zona: 'Centro', plazo: 'semestre', siguiente_paso: 'Concertar valoración del inmueble', proximo_contacto: rel(2), prioridad_comercial: 'media' },
      'm-l4': { operacion_busca: 'comprar', tipo_busca: 'casa', zona: 'Godella, Rocafort', presupuesto_max: 450000, habitaciones_min: 4, financiacion: 'en_tramite', plazo: 'mes', siguiente_paso: 'Confirmar estado de la financiación', proximo_contacto: rel(1), prioridad_comercial: 'alta' },
      'm-l6': { operacion_busca: 'comprar', financiacion: 'preaprobada' },
      'm-l7': { operacion_busca: 'comprar', financiacion: 'no_necesita' },
      'm-l8': { operacion_busca: 'comprar', financiacion: 'sin_mirar' },
      'm-l9': { operacion_busca: 'alquilar', financiacion: 'sin_mirar' },
      'm-l10': { operacion_busca: 'comprar', financiacion: 'sin_mirar' },
      'm-l11': { operacion_busca: 'alquilar', financiacion: 'no_necesita' },
      'm-l12': { operacion_busca: 'comprar', financiacion: 'en_tramite' },
      'm-o1': { inmueble: 'm-in1', tipo_operacion: 'venta', comision: 3 },
      'm-o2': { inmueble: 'm-in2', tipo_operacion: 'alquiler', comision: 100 },
      'm-o3': { inmueble: 'm-in3', tipo_operacion: 'venta', comision: 3 },
      'm-cl1': { rol: 'propietario' }, 'm-cl2': { rol: 'comprador' }, 'm-cl3': { rol: 'inquilino' }, 'm-cl4': { rol: 'propietario' },
    },
  },
  {
    key: 'almacen', kind: 'erp', name: 'Almacén y stock', icon: 'Warehouse',
    pitch: 'Cada producto con EAN, ubicación, lote, caducidad, punto de pedido y proveedor. Entradas y salidas apuntadas, y aviso de lo que falta.',
    modules: ['panel', 'analisis', 'inventario', 'movimientos', 'compras', 'pedidos', 'clientes', 'operaciones'],
    fields: {
      producto: [
        { key: 'ean', label: 'EAN / código de barras', type: 'text' },
        { key: 'ubicacion', label: 'Ubicación', type: 'text', help: 'Pasillo, estantería y balda, por ejemplo A-01-2.' },
        { key: 'unidad', label: 'Unidad', type: 'select', options: opts(['ud', 'Unidad', 'gray'], ['caja', 'Caja', 'blue'], ['kg', 'Kilo', 'amber'], ['l', 'Litro', 'teal'], ['m', 'Metro', 'purple']) },
        { key: 'proveedor', label: 'Proveedor', type: 'relation', relation: 'proveedor' },
        { key: 'lote', label: 'Lote', type: 'text' },
        { key: 'caducidad', label: 'Caducidad', type: 'date' },
        { key: 'punto_pedido', label: 'Punto de pedido', type: 'number', help: 'Con este stock toca pedir.' },
        { key: 'reposicion', label: 'Días de reposición', type: 'number' },
        { key: 'reservado', label: 'Reservado', type: 'number' },
      ],
      pedido: [
        { key: 'canal', label: 'Canal', type: 'select', options: opts(['tienda', 'Tienda', 'blue'], ['web', 'Web', 'teal'], ['telefono', 'Teléfono', 'gray'], ['marketplace', 'Marketplace', 'purple']) },
        { key: 'transportista', label: 'Transportista', type: 'text' },
        { key: 'seguimiento', label: 'N.º de seguimiento', type: 'text' },
      ],
    },
    columns: {
      inventario: ['referencia', 'nombre', 'ubicacion', 'stock', 'minimo', 'caducidad'],
    },
    samples: {
      'm-pr1': { ean: '8412345000101', ubicacion: 'A-01-2', unidad: 'caja', proveedor: 'm-pv1', punto_pedido: 150, reposicion: 5, reservado: 40 },
      'm-pr2': { ean: '8412345000228', ubicacion: 'A-03-1', unidad: 'ud', proveedor: 'm-pv1', punto_pedido: 60, reposicion: 3 },
      'm-pr3': { unidad: 'ud' },
      'm-pr4': { ean: '8412345000505', ubicacion: 'B-02-4', unidad: 'ud', lote: 'L-2609', caducidad: rel(20), punto_pedido: 25, reposicion: 7 },
      'm-pe1': { canal: 'tienda' }, 'm-pe2': { canal: 'web', transportista: 'Seur' }, 'm-pe3': { canal: 'web', transportista: 'MRW', seguimiento: 'MRW-88120' }, 'm-pe4': { canal: 'telefono' },
    },
  },
  {
    key: 'contactos', kind: 'crm', name: 'Control de base de datos', icon: 'DatabaseZap',
    pitch: 'Una base de contactos limpia: consentimiento RGPD con fecha y base legal, origen del dato, última verificación y aviso de duplicados.',
    modules: ['panel', 'analisis', 'contactos', 'clientes', 'automatizaciones', 'documentos'],
    fields: {
      cliente: [
        { key: 'consentimiento', label: 'Consentimiento RGPD', type: 'select', options: opts(['si', 'Sí', 'green'], ['no', 'No', 'red'], ['pendiente', 'Pendiente', 'amber']) },
        { key: 'fuente_dato', label: 'Origen del dato', type: 'text' },
        { key: 'verificado', label: 'Última verificación', type: 'date' },
      ],
    },
    samples: {
      'm-cl1': { consentimiento: 'si', fuente_dato: 'Formulario web', verificado: rel(-30) },
      'm-cl2': { consentimiento: 'si', fuente_dato: 'Contrato', verificado: rel(-200) },
      'm-cl3': { consentimiento: 'pendiente', fuente_dato: 'Evento' },
      'm-cl4': { consentimiento: 'no', fuente_dato: 'Importación' },
    },
  },
];

export const getSector = (key?: string) => (key ? SECTORS.find((s) => s.key === key) : undefined);
