import type { AppRecord, Blueprint, DashboardWidget, Entity, SelectOption, View } from './types.ts';
import { validateBlueprint } from './validate.ts';
import { diffBlueprints } from './diff.ts';
import type { Proposal, SampleRecord } from './agent.ts';
import { DEFAULT_ANALYSIS, tidyAnalysis } from './analysis.ts';
import { getSector } from './sectors.ts';
import { botTemplate, fitBot } from './bot.ts';

// "Mr. Potato" pieces: each module is a card the person adds or removes.
// A module brings the entities it needs (from one shared library, so two
// modules that both need clients share the same clients) and its screens.
// Adding or removing a module edits the blueprint in place, so changes made
// by talking to the assistant are kept.

export type AppKind = 'crm' | 'erp';

export interface ModuleDef {
  key: string;
  kinds: AppKind[];
  name: string;
  pitch: string;        // one line on the card
  icon: string;         // lucide icon name, resolved in the UI
  entities: string[];   // library entity keys (relations pull in the rest)
  views: View[];
}

const opts = (...list: [string, string, SelectOption['color']][]): SelectOption[] =>
  list.map(([value, label, color]) => ({ value, label, color }));
const AREAS = opts(['ventas', 'Ventas', 'blue'], ['operaciones', 'Operaciones', 'amber'], ['administracion', 'Administración', 'purple'], ['atencion', 'Atención', 'teal'], ['personas', 'Personas', 'pink']);
const IVA = opts(['21', '21 %', 'blue'], ['10', '10 %', 'teal'], ['4', '4 %', 'green'], ['0', 'Exento', 'gray']);

export const LIBRARY: Record<string, Entity> = {
  cliente: {
    key: 'cliente', label: 'Cliente', labelPlural: 'Clientes', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'empresa', label: 'Empresa', type: 'text' },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'nif', label: 'NIF/CIF', type: 'nif' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: opts(['nuevo', 'Nuevo', 'blue'], ['habitual', 'Habitual', 'green'], ['vip', 'VIP', 'purple'], ['inactivo', 'Inactivo', 'gray']) },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  lead: {
    key: 'lead', label: 'Lead', labelPlural: 'Leads', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'origen', label: 'Origen', type: 'select', options: opts(['web', 'Web', 'teal'], ['whatsapp', 'WhatsApp', 'green'], ['instagram', 'Instagram', 'pink'], ['recomendacion', 'Recomendación', 'purple'], ['llamada', 'Llamada', 'blue']) },
      { key: 'entrada', label: 'Entró el', type: 'date' },
      { key: 'interes', label: 'Interés', type: 'text' },
      { key: 'valor', label: 'Valor estimado', type: 'money' },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['nuevo', 'Nuevo', 'blue'], ['contactado', 'Contactado', 'amber'], ['cita', 'Cita agendada', 'purple'], ['ganado', 'Ganado', 'green'], ['perdido', 'Perdido', 'gray']) },
      { key: 'motivo', label: 'Motivo de pérdida', type: 'select', options: opts(['precio', 'Precio', 'amber'], ['no_responde', 'No responde', 'gray'], ['competencia', 'Se fue a la competencia', 'red'], ['no_encaja', 'No encaja', 'purple']) },
      { key: 'cita', label: 'Cita', type: 'datetime' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  oportunidad: {
    key: 'oportunidad', label: 'Oportunidad', labelPlural: 'Oportunidades', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Oportunidad', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'etapa', label: 'Etapa', type: 'select', options: opts(['nueva', 'Nueva', 'gray'], ['propuesta', 'Propuesta', 'blue'], ['negociacion', 'Negociación', 'amber'], ['ganada', 'Ganada', 'green'], ['perdida', 'Perdida', 'red']) },
      { key: 'importe', label: 'Importe', type: 'money' },
      { key: 'probabilidad', label: 'Probabilidad', type: 'percent' },
      { key: 'cierre', label: 'Cierre previsto', type: 'date' },
    ],
  },
  cita: {
    key: 'cita', label: 'Cita', labelPlural: 'Citas', titleField: 'asunto',
    fields: [
      { key: 'asunto', label: 'Asunto', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'cuando', label: 'Cuándo', type: 'datetime', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: opts(['llamada', 'Llamada', 'blue'], ['reunion', 'Reunión', 'purple'], ['visita', 'Visita', 'teal'], ['video', 'Videollamada', 'pink']) },
      { key: 'hecha', label: 'Hecha', type: 'boolean' },
    ],
  },
  presupuesto: {
    key: 'presupuesto', label: 'Presupuesto', labelPlural: 'Presupuestos', titleField: 'numero',
    fields: [
      { key: 'numero', label: 'N.º', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'concepto', label: 'Concepto', type: 'text' },
      { key: 'fecha', label: 'Fecha', type: 'date' },
      { key: 'base', label: 'Base imponible', type: 'money' },
      { key: 'iva', label: 'IVA', type: 'select', options: IVA },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['borrador', 'Borrador', 'gray'], ['enviado', 'Enviado', 'blue'], ['aceptado', 'Aceptado', 'green'], ['rechazado', 'Rechazado', 'red']) },
    ],
  },
  ticket: {
    key: 'ticket', label: 'Incidencia', labelPlural: 'Incidencias', titleField: 'asunto',
    fields: [
      { key: 'asunto', label: 'Asunto', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'prioridad', label: 'Prioridad', type: 'select', options: opts(['baja', 'Baja', 'gray'], ['media', 'Media', 'amber'], ['alta', 'Alta', 'red']) },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['abierta', 'Abierta', 'blue'], ['en_curso', 'En curso', 'amber'], ['esperando', 'Esperando al cliente', 'purple'], ['resuelta', 'Resuelta', 'green']) },
      { key: 'abierta', label: 'Abierta el', type: 'date' },
    ],
  },
  factura: {
    key: 'factura', label: 'Factura', labelPlural: 'Facturas', titleField: 'numero',
    fields: [
      { key: 'numero', label: 'N.º factura', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'email', label: 'Email de cobro', type: 'email' },
      { key: 'fecha', label: 'Fecha', type: 'date' },
      { key: 'vence', label: 'Vence', type: 'date' },
      { key: 'base', label: 'Base imponible', type: 'money' },
      { key: 'iva', label: 'IVA', type: 'select', options: IVA },
      { key: 'total', label: 'Total', type: 'money' },
      { key: 'cobro', label: 'Cobro', type: 'select', options: opts(['pendiente', 'Pendiente', 'amber'], ['cobrada', 'Cobrada', 'green'], ['vencida', 'Vencida', 'red']) },
    ],
  },
  producto: {
    key: 'producto', label: 'Producto', labelPlural: 'Productos', titleField: 'nombre',
    fields: [
      { key: 'referencia', label: 'Referencia', type: 'text' },
      { key: 'nombre', label: 'Producto', type: 'text', required: true },
      { key: 'familia', label: 'Familia', type: 'select', options: opts(['general', 'General', 'gray'], ['material', 'Material', 'blue'], ['consumible', 'Consumible', 'teal'], ['servicio', 'Servicio', 'purple']) },
      { key: 'precio', label: 'Precio venta', type: 'money' },
      { key: 'coste', label: 'Coste', type: 'money' },
      { key: 'stock', label: 'Stock', type: 'number' },
      { key: 'minimo', label: 'Stock mínimo', type: 'number' },
    ],
  },
  pedido: {
    key: 'pedido', label: 'Pedido', labelPlural: 'Pedidos', titleField: 'numero',
    fields: [
      { key: 'numero', label: 'N.º pedido', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'entrega', label: 'Entrega', type: 'date' },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['recibido', 'Recibido', 'gray'], ['preparando', 'Preparando', 'amber'], ['enviado', 'Enviado', 'blue'], ['entregado', 'Entregado', 'green']) },
      { key: 'importe', label: 'Importe', type: 'money' },
    ],
  },
  proveedor: {
    key: 'proveedor', label: 'Proveedor', labelPlural: 'Proveedores', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Proveedor', type: 'text', required: true },
      { key: 'nif', label: 'CIF', type: 'nif' },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'categoria', label: 'Categoría', type: 'select', options: opts(['mercancia', 'Mercancía', 'blue'], ['servicios', 'Servicios', 'purple'], ['transporte', 'Transporte', 'teal']) },
    ],
  },
  compra: {
    key: 'compra', label: 'Compra', labelPlural: 'Compras', titleField: 'numero',
    fields: [
      { key: 'numero', label: 'N.º', type: 'text', required: true },
      { key: 'proveedor', label: 'Proveedor', type: 'relation', relation: 'proveedor' },
      { key: 'fecha', label: 'Fecha', type: 'date' },
      { key: 'importe', label: 'Importe', type: 'money' },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['pedida', 'Pedida', 'amber'], ['recibida', 'Recibida', 'blue'], ['pagada', 'Pagada', 'green']) },
    ],
  },
  proyecto: {
    key: 'proyecto', label: 'Proyecto', labelPlural: 'Proyectos', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Proyecto', type: 'text', required: true },
      { key: 'cliente', label: 'Cliente', type: 'relation', relation: 'cliente' },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['pendiente', 'Pendiente', 'gray'], ['en_curso', 'En curso', 'amber'], ['revision', 'En revisión', 'purple'], ['hecho', 'Hecho', 'green']) },
      { key: 'presupuesto', label: 'Presupuesto', type: 'money' },
      { key: 'entrega', label: 'Entrega', type: 'date' },
      { key: 'avance', label: 'Avance', type: 'percent' },
    ],
  },
  persona: {
    key: 'persona', label: 'Persona', labelPlural: 'Equipo', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'puesto', label: 'Puesto', type: 'text' },
      { key: 'area', label: 'Área', type: 'select', options: AREAS },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
    ],
  },
  tarea: {
    key: 'tarea', label: 'Tarea', labelPlural: 'Operaciones', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Tarea', type: 'text', required: true },
      { key: 'estado', label: 'Estado', type: 'select', required: true, options: opts(['pendiente', 'Pendiente', 'gray'], ['en_curso', 'En curso', 'amber'], ['bloqueada', 'Bloqueada', 'red'], ['hecha', 'Hecha', 'green']) },
      { key: 'responsable', label: 'Responsable', type: 'relation', relation: 'persona' },
      { key: 'proceso', label: 'Proceso', type: 'relation', relation: 'proceso' },
      { key: 'prioridad', label: 'Prioridad', type: 'select', options: opts(['alta', 'Alta', 'red'], ['media', 'Media', 'amber'], ['baja', 'Baja', 'gray']) },
      { key: 'limite', label: 'Para el', type: 'date' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  proceso: {
    key: 'proceso', label: 'Proceso', labelPlural: 'Procesos', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Proceso', type: 'text', required: true },
      { key: 'area', label: 'Área', type: 'select', options: AREAS },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['borrador', 'Borrador', 'gray'], ['activo', 'En uso', 'green'], ['revisar', 'Revisar', 'amber']) },
      { key: 'frecuencia', label: 'Cuándo', type: 'select', options: opts(['cada_cliente', 'Con cada cliente', 'blue'], ['diario', 'Cada día', 'teal'], ['semanal', 'Cada semana', 'purple'], ['mensual', 'Cada mes', 'pink'], ['puntual', 'Cuando toque', 'gray']) },
      { key: 'pasos', label: 'Pasos (uno por línea)', type: 'longtext', help: 'Cada línea será una tarea al lanzar el proceso.' },
    ],
  },
  documento: {
    key: 'documento', label: 'Documento', labelPlural: 'Documentación', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Documento', type: 'text', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: opts(['contrato', 'Contrato', 'blue'], ['manual', 'Manual', 'teal'], ['plantilla', 'Plantilla', 'purple'], ['legal', 'Legal', 'red'], ['proveedor', 'De proveedor', 'amber'], ['otro', 'Otro', 'gray']) },
      { key: 'area', label: 'Área', type: 'select', options: AREAS },
      { key: 'enlace', label: 'Enlace', type: 'url', help: 'Drive, Dropbox, OneDrive…' },
      { key: 'version', label: 'Versión', type: 'text' },
      { key: 'caduca', label: 'Caduca o se revisa', type: 'date' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  automatizacion: {
    key: 'automatizacion', label: 'Automatización', labelPlural: 'Automatizaciones', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Automatización', type: 'text', required: true },
      { key: 'seccion', label: 'Sección', type: 'text', required: true, help: 'La sección que la dispara, tal como se llama (por ejemplo «Leads»).' },
      { key: 'evento', label: 'Cuándo', type: 'select', required: true, options: opts(['alta', 'Al crear uno nuevo', 'blue'], ['cambio', 'Al cambiar de estado', 'purple'], ['cualquiera', 'Con cualquier cambio', 'gray']) },
      { key: 'estado_destino', label: 'Solo si pasa a', type: 'text', help: 'Opcional: el estado, por ejemplo «Ganado».' },
      { key: 'url', label: 'Webhook', type: 'url', required: true, help: 'La URL del webhook de n8n, Make o Zapier (https).' },
      { key: 'estado', label: 'Estado', type: 'select', required: true, options: opts(['activa', 'Activa', 'green'], ['pausada', 'Pausada', 'gray']) },
      { key: 'ultimo_envio', label: 'Último envío', type: 'datetime' },
      { key: 'resultado', label: 'Resultado', type: 'text' },
    ],
  },
  inmueble: {
    key: 'inmueble', label: 'Inmueble', labelPlural: 'Inmuebles', titleField: 'direccion',
    fields: [
      { key: 'referencia', label: 'Referencia', type: 'text' },
      { key: 'direccion', label: 'Dirección', type: 'text', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: opts(['piso', 'Piso', 'blue'], ['casa', 'Casa o chalet', 'green'], ['atico', 'Ático', 'purple'], ['local', 'Local', 'amber'], ['oficina', 'Oficina', 'gray'], ['garaje', 'Garaje', 'gray'], ['terreno', 'Terreno', 'teal']) },
      { key: 'operacion', label: 'Operación', type: 'select', options: opts(['venta', 'Venta', 'blue'], ['alquiler', 'Alquiler', 'teal'], ['turistico', 'Alquiler turístico', 'pink']) },
      { key: 'estado', label: 'Estado', type: 'select', options: opts(['captacion', 'En captación', 'gray'], ['disponible', 'Disponible', 'blue'], ['reservado', 'Reservado', 'amber'], ['vendido', 'Vendido', 'green'], ['alquilado', 'Alquilado', 'teal'], ['retirado', 'Retirado', 'red']) },
      { key: 'precio', label: 'Precio', type: 'money' },
      { key: 'metros', label: 'm²', type: 'number' },
      { key: 'habitaciones', label: 'Habitaciones', type: 'number' },
      { key: 'banos', label: 'Baños', type: 'number' },
      { key: 'zona', label: 'Zona', type: 'text' },
      { key: 'certificado', label: 'Certificado energético', type: 'select', options: opts(['a', 'A', 'green'], ['b', 'B', 'green'], ['c', 'C', 'teal'], ['d', 'D', 'amber'], ['e', 'E', 'amber'], ['f', 'F', 'red'], ['g', 'G', 'red'], ['tramite', 'En trámite', 'gray']) },
      { key: 'exclusiva', label: 'En exclusiva', type: 'boolean' },
      { key: 'propietario', label: 'Propietario', type: 'relation', relation: 'cliente' },
      { key: 'captado', label: 'Captado el', type: 'date' },
      { key: 'foto', label: 'Foto', type: 'url', help: 'Enlace a la foto principal.' },
      { key: 'agente', label: 'Agente', type: 'relation', relation: 'persona' },
      { key: 'capacidad', label: 'Huéspedes', type: 'number' },
      { key: 'licencia', label: 'Licencia turística', type: 'text' },
      { key: 'precio_noche', label: 'Precio por noche', type: 'money' },
      { key: 'tarifa_limpieza', label: 'Tarifa de limpieza', type: 'money' },
      { key: 'airbnb_url', label: 'Anuncio en Airbnb', type: 'url' },
      { key: 'booking_url', label: 'Anuncio en Booking', type: 'url' },
      { key: 'ical_airbnb', label: 'Calendario iCal de Airbnb', type: 'url', help: 'Airbnb → Calendario → Exportar calendario. Las reservas se importan solas.' },
      { key: 'ical_booking', label: 'Calendario iCal de Booking', type: 'url', help: 'Extranet de Booking → Tarifas y disponibilidad → Sincronizar calendarios.' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  visita: {
    key: 'visita', label: 'Visita', labelPlural: 'Visitas', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Visita', type: 'text', required: true },
      { key: 'inmueble', label: 'Inmueble', type: 'relation', relation: 'inmueble' },
      { key: 'lead', label: 'Interesado', type: 'relation', relation: 'lead' },
      { key: 'cuando', label: 'Cuándo', type: 'datetime', required: true },
      { key: 'resultado', label: 'Resultado', type: 'select', options: opts(['pendiente', 'Pendiente', 'gray'], ['interesa', 'Le interesa', 'green'], ['no_encaja', 'No encaja', 'red'], ['oferta', 'Hace oferta', 'purple']) },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  movimiento: {
    key: 'movimiento', label: 'Movimiento', labelPlural: 'Movimientos', titleField: 'concepto',
    fields: [
      { key: 'concepto', label: 'Concepto', type: 'text', required: true },
      { key: 'producto', label: 'Producto', type: 'relation', relation: 'producto' },
      { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: opts(['entrada', 'Entrada', 'green'], ['salida', 'Salida', 'blue'], ['ajuste', 'Ajuste de inventario', 'amber'], ['devolucion', 'Devolución', 'purple']) },
      { key: 'cantidad', label: 'Cantidad', type: 'number' },
      { key: 'fecha', label: 'Fecha', type: 'date' },
      { key: 'lote', label: 'Lote', type: 'text' },
      { key: 'motivo', label: 'Motivo', type: 'text' },
    ],
  },
  contacto: {
    key: 'contacto', label: 'Contacto', labelPlural: 'Contactos', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'apellidos', label: 'Apellidos', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'empresa', label: 'Empresa', type: 'text' },
      { key: 'cargo', label: 'Cargo', type: 'text' },
      { key: 'provincia', label: 'Provincia', type: 'text' },
      { key: 'cp', label: 'Código postal', type: 'text' },
      { key: 'idioma', label: 'Idioma', type: 'select', options: opts(['es', 'Castellano', 'blue'], ['ca', 'Catalán / valenciano', 'amber'], ['eu', 'Euskera', 'green'], ['gl', 'Gallego', 'teal'], ['en', 'Inglés', 'purple']) },
      { key: 'fuente', label: 'Origen del dato', type: 'select', options: opts(['formulario', 'Formulario web', 'teal'], ['evento', 'Evento o feria', 'purple'], ['compra', 'Compra', 'green'], ['importacion', 'Importación', 'gray'], ['referido', 'Recomendación', 'blue']) },
      { key: 'consentimiento', label: 'Consentimiento RGPD', type: 'select', options: opts(['si', 'Sí', 'green'], ['no', 'No', 'red'], ['pendiente', 'Pendiente', 'amber']) },
      { key: 'consentimiento_fecha', label: 'Fecha del consentimiento', type: 'date' },
      { key: 'base_legal', label: 'Base legal', type: 'select', options: opts(['consentimiento', 'Consentimiento', 'green'], ['contrato', 'Contrato', 'blue'], ['interes', 'Interés legítimo', 'amber']) },
      { key: 'etiquetas', label: 'Etiquetas', type: 'text', help: 'Separadas por comas.' },
      { key: 'verificado', label: 'Última verificación', type: 'date' },
      { key: 'estado', label: 'Estado del dato', type: 'select', options: opts(['revisar', 'Por revisar', 'amber'], ['valido', 'Válido', 'green'], ['rebotado', 'Rebotado', 'red'], ['baja', 'Baja', 'gray']) },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  gasto: {
    key: 'gasto', label: 'Gasto', labelPlural: 'Gastos', titleField: 'concepto',
    fields: [
      { key: 'concepto', label: 'Concepto', type: 'text', required: true },
      { key: 'fecha', label: 'Fecha', type: 'date' },
      { key: 'categoria', label: 'Categoría', type: 'select', options: opts(['alquiler', 'Alquiler', 'blue'], ['suministros', 'Suministros', 'teal'], ['marketing', 'Marketing', 'pink'], ['personal', 'Personal', 'purple'], ['otros', 'Otros', 'gray']) },
      { key: 'importe', label: 'Importe', type: 'money' },
      { key: 'deducible', label: 'Deducible', type: 'boolean' },
    ],
  },
  contacto_inmo: {
    key: 'contacto_inmo', label: 'Contacto', labelPlural: 'Contactos', titleField: 'nombre',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'apellidos', label: 'Apellidos', type: 'text' },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'tipo', label: 'Es', type: 'select', options: opts(['comprador', 'Comprador', 'blue'], ['vendedor', 'Vendedor', 'pink'], ['propietario', 'Propietario', 'purple'], ['inversor', 'Inversor', 'green'], ['arrendatario', 'Inquilino', 'teal'], ['colaborador', 'Colaborador', 'amber'], ['huesped', 'Huésped', 'gray']) },
      { key: 'temperatura', label: 'Temperatura', type: 'select', required: true, options: opts(['caliente', 'Caliente', 'red'], ['templado', 'Templado', 'amber'], ['frio', 'Frío', 'blue'], ['cerrado', 'Cerrado', 'green'], ['descartado', 'Descartado', 'gray']) },
      { key: 'proxima_accion', label: 'Próxima acción', type: 'text' },
      { key: 'seguimiento', label: 'Seguimiento', type: 'datetime' },
      { key: 'presupuesto', label: 'Presupuesto', type: 'money' },
      { key: 'zonas', label: 'Zonas', type: 'text' },
      { key: 'tipo_deseado', label: 'Busca', type: 'select', options: opts(['piso', 'Piso', 'blue'], ['casa', 'Casa o chalet', 'green'], ['atico', 'Ático', 'purple'], ['local', 'Local', 'amber'], ['oficina', 'Oficina', 'gray'], ['terreno', 'Terreno', 'teal']) },
      { key: 'habitaciones_min', label: 'Habitaciones mínimas', type: 'number' },
      { key: 'metros_min', label: 'm² mínimos', type: 'number' },
      { key: 'origen', label: 'Origen', type: 'select', options: opts(['idealista', 'Idealista', 'green'], ['fotocasa', 'Fotocasa', 'blue'], ['web', 'Web', 'teal'], ['instagram', 'Instagram', 'pink'], ['recomendacion', 'Recomendación', 'purple'], ['cartel', 'Cartel', 'amber'], ['llamada', 'Llamada', 'gray'], ['airbnb', 'Airbnb', 'red'], ['booking', 'Booking', 'blue']) },
      { key: 'agente', label: 'Agente', type: 'relation', relation: 'persona' },
      { key: 'prioridad', label: 'Prioridad', type: 'select', options: opts(['alta', 'Alta', 'red'], ['media', 'Media', 'amber'], ['baja', 'Baja', 'gray']) },
      { key: 'alta', label: 'Alta', type: 'date' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  operacion: {
    key: 'operacion', label: 'Operación', labelPlural: 'Operaciones', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Operación', type: 'text', required: true },
      { key: 'embudo', label: 'Embudo', type: 'select', options: opts(['compradores', 'Compradores', 'blue'], ['vendedores', 'Vendedores', 'pink'], ['captacion', 'Captación', 'purple'], ['alquileres', 'Alquileres', 'teal']) },
      { key: 'etapa', label: 'Etapa', type: 'select', required: true, options: opts(['lead_nuevo', 'Lead nuevo', 'gray'], ['contactado', 'Contactado', 'blue'], ['cualificado', 'Cualificado', 'teal'], ['visita', 'Visita', 'purple'], ['negociacion', 'Negociación', 'amber'], ['oferta', 'Oferta', 'pink'], ['cerrada', 'Cerrada', 'green'], ['perdida', 'Perdida', 'red']) },
      { key: 'contacto', label: 'Contacto', type: 'relation', relation: 'contacto_inmo' },
      { key: 'inmueble', label: 'Inmueble', type: 'relation', relation: 'inmueble' },
      { key: 'importe', label: 'Importe', type: 'money' },
      { key: 'comision', label: 'Comisión', type: 'percent' },
      { key: 'probabilidad', label: 'Probabilidad', type: 'percent' },
      { key: 'agente', label: 'Agente', type: 'relation', relation: 'persona' },
      { key: 'cierre', label: 'Cierre previsto', type: 'date' },
      { key: 'motivo_perdida', label: 'Por qué se perdió', type: 'select', options: opts(['precio', 'Precio', 'red'], ['financiacion', 'Financiación', 'amber'], ['otra_agencia', 'Otra agencia', 'purple'], ['no_encaja', 'No encaja', 'gray'], ['sin_respuesta', 'Sin respuesta', 'blue']) },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  cita_inmo: {
    key: 'cita_inmo', label: 'Cita', labelPlural: 'Agenda', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Cita', type: 'text', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: opts(['visita', 'Visita', 'purple'], ['captacion', 'Captación', 'pink'], ['firma', 'Firma', 'green'], ['llamada', 'Llamada', 'blue'], ['tasacion', 'Tasación', 'amber']) },
      { key: 'cuando', label: 'Cuándo', type: 'datetime', required: true },
      { key: 'contacto', label: 'Contacto', type: 'relation', relation: 'contacto_inmo' },
      { key: 'inmueble', label: 'Inmueble', type: 'relation', relation: 'inmueble' },
      { key: 'agente', label: 'Agente', type: 'relation', relation: 'persona' },
      { key: 'resultado', label: 'Resultado', type: 'select', options: opts(['pendiente', 'Pendiente', 'gray'], ['interesa', 'Le interesa', 'green'], ['no_encaja', 'No encaja', 'red'], ['oferta', 'Hace oferta', 'purple'], ['hecha', 'Hecha', 'blue']) },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  reserva: {
    key: 'reserva', label: 'Reserva', labelPlural: 'Reservas', titleField: 'huesped',
    fields: [
      { key: 'huesped', label: 'Huésped', type: 'text', required: true },
      { key: 'alojamiento', label: 'Alojamiento', type: 'relation', relation: 'inmueble', required: true },
      { key: 'canal', label: 'Canal', type: 'select', options: opts(['airbnb', 'Airbnb', 'red'], ['booking', 'Booking', 'blue'], ['directa', 'Directa', 'green'], ['otro', 'Otro', 'gray']) },
      { key: 'entrada', label: 'Entrada', type: 'date', required: true },
      { key: 'salida', label: 'Salida', type: 'date', required: true },
      { key: 'estado', label: 'Estado', type: 'select', required: true, options: opts(['pendiente', 'Por confirmar', 'amber'], ['confirmada', 'Confirmada', 'blue'], ['en_casa', 'En la casa', 'purple'], ['finalizada', 'Finalizada', 'green'], ['cancelada', 'Cancelada', 'red'], ['bloqueo', 'Bloqueo', 'gray']) },
      { key: 'huespedes', label: 'Huéspedes', type: 'number' },
      { key: 'importe', label: 'Importe', type: 'money' },
      { key: 'comision', label: 'Comisión del canal', type: 'money' },
      { key: 'gastos', label: 'Gastos', type: 'money', help: 'Limpieza, lavandería, suministros…' },
      { key: 'pago', label: 'Pago', type: 'select', options: opts(['pendiente', 'Pendiente', 'amber'], ['parcial', 'Parcial', 'purple'], ['cobrado', 'Cobrado', 'green'], ['sin_dato', 'Sin dato', 'gray']) },
      { key: 'localizador', label: 'Localizador', type: 'text' },
      { key: 'telefono', label: 'Teléfono', type: 'phone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'llegada', label: 'Hora de llegada', type: 'text' },
      { key: 'ref_externa', label: 'Referencia del canal', type: 'text', help: 'La pone la sincronización iCal; no la cambies.' },
      { key: 'origen_sync', label: 'Origen', type: 'select', options: opts(['manual', 'A mano', 'gray'], ['ical', 'Calendario iCal', 'teal']) },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  servicio: {
    key: 'servicio', label: 'Servicio', labelPlural: 'Limpiezas y tareas', titleField: 'titulo',
    fields: [
      { key: 'titulo', label: 'Tarea', type: 'text', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: opts(['limpieza', 'Limpieza', 'teal'], ['check_in', 'Check-in', 'blue'], ['check_out', 'Check-out', 'purple'], ['mantenimiento', 'Mantenimiento', 'amber'], ['revision', 'Revisión', 'gray']) },
      { key: 'alojamiento', label: 'Alojamiento', type: 'relation', relation: 'inmueble' },
      { key: 'reserva', label: 'Reserva', type: 'relation', relation: 'reserva' },
      { key: 'fecha', label: 'Cuándo', type: 'datetime' },
      { key: 'responsable', label: 'Responsable', type: 'relation', relation: 'persona' },
      { key: 'estado', label: 'Estado', type: 'select', required: true, options: opts(['pendiente', 'Pendiente', 'gray'], ['asignada', 'Asignada', 'blue'], ['hecha', 'Hecha', 'green'], ['problema', 'Con problema', 'red']) },
      { key: 'coste', label: 'Coste', type: 'money' },
      { key: 'checklist', label: 'Checklist (uno por línea)', type: 'longtext' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  incidencia: {
    key: 'incidencia', label: 'Incidencia', labelPlural: 'Incidencias', titleField: 'asunto',
    fields: [
      { key: 'asunto', label: 'Asunto', type: 'text', required: true },
      { key: 'alojamiento', label: 'Alojamiento', type: 'relation', relation: 'inmueble' },
      { key: 'prioridad', label: 'Prioridad', type: 'select', options: opts(['alta', 'Alta', 'red'], ['media', 'Media', 'amber'], ['baja', 'Baja', 'gray']) },
      { key: 'estado', label: 'Estado', type: 'select', required: true, options: opts(['abierta', 'Abierta', 'red'], ['en_curso', 'En curso', 'amber'], ['resuelta', 'Resuelta', 'green']) },
      { key: 'responsable', label: 'Responsable', type: 'relation', relation: 'persona' },
      { key: 'abierta', label: 'Abierta el', type: 'date' },
      { key: 'coste', label: 'Coste', type: 'money' },
      { key: 'notas', label: 'Notas', type: 'longtext' },
    ],
  },
  // One per person who talks to the Instagram assistant (bot.ts fills it).
  conversacion: {
    key: 'conversacion', label: 'Conversación', labelPlural: 'Conversaciones de Instagram', titleField: 'usuario',
    fields: [
      { key: 'usuario', label: 'Usuario', type: 'text', required: true, help: 'Su @ de Instagram.' },
      { key: 'nombre', label: 'Nombre', type: 'text' },
      { key: 'estado', label: 'Estado', type: 'select', required: true, options: opts(['en_curso', 'En curso', 'blue'], ['cualificado', 'Cualificado', 'teal'], ['agendado', 'Con cita', 'purple'], ['reservado', 'Reserva pedida', 'green'], ['humano', 'Para una persona', 'amber'], ['descartado', 'Descartado', 'gray']) },
      { key: 'puntuacion', label: 'Puntuación', type: 'number', help: 'De 0 a 100, según las reglas del asistente.' },
      { key: 'interes', label: 'Busca', type: 'select', options: opts(['comprar', 'Comprar', 'blue'], ['vender', 'Vender', 'pink'], ['alquilar', 'Alquilar', 'teal'], ['invertir', 'Invertir', 'green'], ['reservar', 'Reservar', 'purple'], ['informacion', 'Información', 'gray']) },
      { key: 'presupuesto', label: 'Presupuesto', type: 'money' },
      { key: 'zona', label: 'Zona', type: 'text' },
      { key: 'plazo', label: 'Plazo', type: 'select', options: opts(['ya', 'Cuanto antes', 'red'], ['tres_meses', 'En 3–6 meses', 'amber'], ['mas_adelante', 'Más adelante', 'blue'], ['mirando', 'Solo mirando', 'gray']) },
      { key: 'fechas', label: 'Fechas que pide', type: 'text' },
      { key: 'huespedes', label: 'Personas', type: 'number' },
      { key: 'disparador', label: 'Empezó por', type: 'select', options: opts(['comentario', 'Comentario', 'pink'], ['historia', 'Historia', 'purple'], ['dm', 'Mensaje directo', 'blue'], ['anuncio', 'Anuncio', 'amber']) },
      { key: 'palabra_clave', label: 'Palabra clave', type: 'text' },
      { key: 'canal', label: 'Canal', type: 'select', options: opts(['instagram', 'Instagram', 'pink']) },
      { key: 'contacto', label: 'Contacto', type: 'relation', relation: 'contacto_inmo' },
      { key: 'inmueble', label: 'Inmueble', type: 'relation', relation: 'inmueble' },
      { key: 'cita', label: 'Cita', type: 'datetime' },
      { key: 'inicio', label: 'Empezó', type: 'datetime' },
      { key: 'ultima_actividad', label: 'Último mensaje', type: 'datetime' },
      { key: 'enlace', label: 'Chat en Instagram', type: 'url' },
      { key: 'ig_id', label: 'ID de Instagram', type: 'text', help: 'Lo pone Instagram; no lo cambies.' },
      { key: 'resumen', label: 'Resumen', type: 'longtext' },
      { key: 'transcripcion', label: 'Conversación', type: 'longtext' },
    ],
  },
};

const HOURS = { days: [1, 2, 3, 4, 5], from: '09:00', to: '19:00', slotMinutes: 60, breakFrom: '14:00', breakTo: '16:00' };

export const MODULES: ModuleDef[] = [
  {
    key: 'leads', kinds: ['crm'], name: 'Leads', icon: 'Magnet',
    pitch: 'Contactos nuevos con la acción que toca en cada momento y huecos para agendar.',
    entities: ['lead'],
    views: [{
      key: 'leads', label: 'Leads', type: 'worklist', entity: 'lead', groupBy: 'estado', columns: ['interes', 'valor', 'origen', 'cita'],
      actions: [
        { kind: 'call', label: 'Llamar', field: 'telefono', when: ['nuevo', 'contactado'] },
        { kind: 'schedule', label: 'Agendar cita', field: 'cita', to: 'cita', when: ['nuevo', 'contactado'] },
        { kind: 'whatsapp', label: 'WhatsApp', field: 'telefono' },
        { kind: 'move', label: 'Contactado', to: 'contactado', when: ['nuevo'] },
        { kind: 'move', label: 'Ganado', to: 'ganado', when: ['cita'] },
        { kind: 'schedule', label: 'Cambiar cita', field: 'cita', when: ['cita'] },
        { kind: 'move', label: 'Perdido', to: 'perdido', when: ['nuevo', 'contactado', 'cita'] },
      ],
      availability: HOURS,
    }],
  },
  {
    key: 'embudo', kinds: ['crm'], name: 'Embudo de ventas', icon: 'Filter',
    pitch: 'Tus oportunidades por etapas, con el importe de cada columna.',
    entities: ['oportunidad'],
    views: [{ key: 'embudo', label: 'Embudo', type: 'kanban', entity: 'oportunidad', groupBy: 'etapa', sumField: 'importe' }],
  },
  {
    key: 'agenda', kinds: ['crm', 'erp'], name: 'Agenda', icon: 'CalendarDays',
    pitch: 'Llamadas, reuniones y visitas en el calendario.',
    entities: ['cita'],
    views: [{ key: 'agenda', label: 'Agenda', type: 'calendar', entity: 'cita', dateField: 'cuando' }],
  },
  {
    key: 'clientes', kinds: ['crm', 'erp'], name: 'Clientes', icon: 'Users',
    pitch: 'Tu cartera con NIF, contacto y tipo de cliente.',
    entities: ['cliente'],
    views: [{ key: 'clientes', label: 'Clientes', type: 'table', entity: 'cliente', columns: ['nombre', 'empresa', 'telefono', 'email', 'tipo'] }],
  },
  {
    key: 'presupuestos', kinds: ['crm', 'erp'], name: 'Presupuestos', icon: 'FileText',
    pitch: 'Del borrador al aceptado, con IVA y base a la vista.',
    entities: ['presupuesto'],
    views: [{ key: 'presupuestos', label: 'Presupuestos', type: 'kanban', entity: 'presupuesto', groupBy: 'estado', sumField: 'base' }],
  },
  {
    key: 'soporte', kinds: ['crm'], name: 'Soporte', icon: 'LifeBuoy',
    pitch: 'Incidencias de clientes con prioridad y siguiente paso.',
    entities: ['ticket'],
    views: [{
      key: 'soporte', label: 'Incidencias', type: 'worklist', entity: 'ticket', groupBy: 'estado', columns: ['cliente', 'prioridad', 'abierta'],
      actions: [
        { kind: 'move', label: 'Empezar', to: 'en_curso', when: ['abierta'] },
        { kind: 'call', label: 'Llamar', field: 'telefono', when: ['abierta', 'en_curso', 'esperando'] },
        { kind: 'email', label: 'Escribir', field: 'email', when: ['en_curso', 'esperando'] },
        { kind: 'move', label: 'Esperar respuesta', to: 'esperando', when: ['en_curso'] },
        { kind: 'move', label: 'Resolver', to: 'resuelta', when: ['en_curso', 'esperando'] },
        { kind: 'move', label: 'Reabrir', to: 'abierta', when: ['resuelta'] },
      ],
    }],
  },
  {
    key: 'facturas', kinds: ['erp'], name: 'Facturas y cobros', icon: 'Receipt',
    pitch: 'Qué está cobrado, qué vence y a quién recordárselo.',
    entities: ['factura'],
    views: [{
      key: 'facturas', label: 'Facturas', type: 'worklist', entity: 'factura', groupBy: 'cobro', columns: ['cliente', 'total', 'iva', 'vence'],
      actions: [
        { kind: 'email', label: 'Recordar pago', field: 'email', when: ['pendiente', 'vencida'] },
        { kind: 'move', label: 'Marcar cobrada', to: 'cobrada', when: ['pendiente', 'vencida'] },
        { kind: 'move', label: 'Marcar vencida', to: 'vencida', when: ['pendiente'] },
      ],
    }],
  },
  {
    key: 'pedidos', kinds: ['erp'], name: 'Pedidos', icon: 'Package',
    pitch: 'De recibido a entregado, arrastrando tarjetas.',
    entities: ['pedido'],
    views: [{ key: 'pedidos', label: 'Pedidos', type: 'kanban', entity: 'pedido', groupBy: 'estado', sumField: 'importe' }],
  },
  {
    key: 'inventario', kinds: ['erp'], name: 'Inventario', icon: 'Boxes',
    pitch: 'Productos, precios, coste y stock mínimo.',
    entities: ['producto'],
    views: [{ key: 'inventario', label: 'Inventario', type: 'table', entity: 'producto', columns: ['referencia', 'nombre', 'familia', 'precio', 'stock', 'minimo'] }],
  },
  {
    key: 'compras', kinds: ['erp'], name: 'Compras y proveedores', icon: 'Truck',
    pitch: 'Lo que pides, a quién y si está pagado.',
    entities: ['compra', 'proveedor'],
    views: [
      { key: 'compras', label: 'Compras', type: 'table', entity: 'compra', columns: ['numero', 'proveedor', 'fecha', 'importe', 'estado'] },
      { key: 'proveedores', label: 'Proveedores', type: 'table', entity: 'proveedor', columns: ['nombre', 'nif', 'telefono', 'categoria'] },
    ],
  },
  {
    key: 'proyectos', kinds: ['crm', 'erp'], name: 'Proyectos', icon: 'FolderKanban',
    pitch: 'Trabajos en curso con presupuesto, entrega y avance.',
    entities: ['proyecto'],
    views: [{ key: 'proyectos', label: 'Proyectos', type: 'kanban', entity: 'proyecto', groupBy: 'estado', sumField: 'presupuesto' }],
  },
  {
    key: 'gastos', kinds: ['erp'], name: 'Gastos', icon: 'Wallet',
    pitch: 'Gastos por categoría y si desgravan.',
    entities: ['gasto'],
    views: [{ key: 'gastos', label: 'Gastos', type: 'table', entity: 'gasto', columns: ['concepto', 'fecha', 'categoria', 'importe', 'deducible'] }],
  },
  {
    key: 'operaciones', kinds: ['crm', 'erp'], name: 'Operaciones y procesos', icon: 'Workflow',
    pitch: 'Quién hace qué y para cuándo. Tus procesos paso a paso, y con un clic se vuelven tareas.',
    entities: ['tarea', 'proceso', 'persona'],
    views: [
      {
        key: 'operaciones', label: 'Operaciones', type: 'worklist', entity: 'tarea', groupBy: 'estado', columns: ['responsable', 'prioridad', 'limite', 'proceso'],
        actions: [
          { kind: 'move', label: 'Empezar', to: 'en_curso', when: ['pendiente', 'bloqueada'] },
          { kind: 'move', label: 'Hecha', to: 'hecha', when: ['pendiente', 'en_curso'] },
          { kind: 'move', label: 'Bloqueada', to: 'bloqueada', when: ['en_curso'] },
          { kind: 'move', label: 'Reabrir', to: 'pendiente', when: ['hecha'] },
        ],
      },
      {
        key: 'procesos', label: 'Procesos', type: 'worklist', entity: 'proceso', groupBy: 'estado', columns: ['area', 'frecuencia'],
        actions: [
          { kind: 'launch', label: 'Lanzar como tareas', field: 'pasos', entity: 'tarea', when: ['activo'] },
          { kind: 'move', label: 'Ponerlo en uso', to: 'activo', when: ['borrador', 'revisar'] },
          { kind: 'move', label: 'Hay que revisarlo', to: 'revisar', when: ['activo'] },
        ],
      },
      { key: 'equipo', label: 'Equipo', type: 'table', entity: 'persona', columns: ['nombre', 'puesto', 'area', 'telefono', 'email'] },
    ],
  },
  {
    key: 'documentos', kinds: ['crm', 'erp'], name: 'Documentación', icon: 'FolderOpen',
    pitch: 'Contratos, manuales y plantillas en un sitio, con aviso de lo que caduca.',
    entities: ['documento'],
    views: [{ key: 'documentos', label: 'Documentación', type: 'table', entity: 'documento', columns: ['titulo', 'tipo', 'area', 'enlace', 'caduca'] }],
  },
  {
    key: 'automatizaciones', kinds: ['crm', 'erp'], name: 'Automatizaciones', icon: 'Zap',
    pitch: 'Cuando pase algo (un lead nuevo, una factura cobrada…), avisa a tu n8n, Make o Zapier.',
    entities: ['automatizacion'],
    views: [{
      key: 'automatizaciones', label: 'Automatizaciones', type: 'worklist', entity: 'automatizacion', groupBy: 'estado', columns: ['seccion', 'evento', 'estado_destino', 'ultimo_envio', 'resultado'],
      actions: [
        { kind: 'webhook', label: 'Probar', field: 'url' },
        { kind: 'move', label: 'Pausar', to: 'pausada', when: ['activa'] },
        { kind: 'move', label: 'Activar', to: 'activa', when: ['pausada'] },
      ],
    }],
  },
  {
    key: 'inmuebles', kinds: ['crm'], name: 'Inmuebles', icon: 'Building2',
    pitch: 'Tu cartera de la captación a la venta, con referencia, m², certificado y exclusiva.',
    entities: ['inmueble'],
    views: [{ key: 'inmuebles', label: 'Inmuebles', type: 'kanban', entity: 'inmueble', groupBy: 'estado', sumField: 'precio' }],
  },
  {
    key: 'visitas', kinds: ['crm'], name: 'Visitas', icon: 'DoorOpen',
    pitch: 'Quién ve qué inmueble y cuándo, y qué le pareció.',
    entities: ['visita'],
    views: [{ key: 'visitas', label: 'Visitas', type: 'calendar', entity: 'visita', dateField: 'cuando' }],
  },
  {
    key: 'movimientos', kinds: ['erp'], name: 'Entradas y salidas', icon: 'ArrowLeftRight',
    pitch: 'Cada entrada, salida, ajuste o devolución de almacén, con lote y motivo.',
    entities: ['movimiento'],
    views: [{ key: 'movimientos', label: 'Movimientos', type: 'table', entity: 'movimiento', columns: ['fecha', 'concepto', 'producto', 'tipo', 'cantidad', 'lote'] }],
  },
  {
    key: 'contactos', kinds: ['crm', 'erp'], name: 'Base de contactos', icon: 'Contact',
    pitch: 'Todos tus contactos con consentimiento RGPD, origen del dato y verificación, y aviso de duplicados.',
    entities: ['contacto'],
    views: [{
      key: 'contactos', label: 'Contactos', type: 'worklist', entity: 'contacto', groupBy: 'estado', columns: ['empresa', 'email', 'consentimiento', 'verificado'],
      actions: [
        { kind: 'email', label: 'Escribir', field: 'email', when: ['revisar', 'valido'] },
        { kind: 'call', label: 'Llamar', field: 'telefono', when: ['revisar', 'valido', 'rebotado'] },
        { kind: 'move', label: 'Verificado', to: 'valido', when: ['revisar', 'rebotado'] },
        { kind: 'move', label: 'Rebotado', to: 'rebotado', when: ['revisar', 'valido'] },
        { kind: 'move', label: 'Dar de baja', to: 'baja', when: ['revisar', 'valido', 'rebotado'] },
      ],
    }],
  },
  {
    key: 'centro', kinds: ['crm'], name: 'Centro de operaciones', icon: 'LayoutDashboard',
    pitch: 'Lo que pasa hoy: entradas, salidas, limpiezas, visitas, operaciones abiertas y avisos.',
    entities: [],
    views: [{ key: 'centro', label: 'Centro de operaciones', type: 'ops' }],
  },
  {
    key: 'contactos_inmo', kinds: ['crm'], name: 'Contactos', icon: 'Users',
    pitch: 'Compradores, vendedores, propietarios e inversores con su temperatura y su próxima acción.',
    entities: ['contacto_inmo'],
    views: [{
      key: 'contactos_inmo', label: 'Contactos', type: 'worklist', entity: 'contacto_inmo', groupBy: 'temperatura', columns: ['tipo', 'proxima_accion', 'seguimiento', 'presupuesto', 'zonas', 'origen'],
      actions: [
        { kind: 'call', label: 'Llamar', field: 'telefono', when: ['caliente', 'templado', 'frio'] },
        { kind: 'whatsapp', label: 'WhatsApp', field: 'telefono', when: ['caliente', 'templado', 'frio'] },
        { kind: 'email', label: 'Escribir', field: 'email', when: ['caliente', 'templado', 'frio'] },
        { kind: 'schedule', label: 'Agendar seguimiento', field: 'seguimiento', when: ['caliente', 'templado', 'frio'] },
        { kind: 'move', label: 'Caliente', to: 'caliente', when: ['templado', 'frio'] },
        { kind: 'move', label: 'Enfriar', to: 'frio', when: ['caliente', 'templado'] },
        { kind: 'move', label: 'Descartar', to: 'descartado', when: ['caliente', 'templado', 'frio'] },
        { kind: 'move', label: 'Recuperar', to: 'templado', when: ['descartado', 'cerrado'] },
      ],
      availability: HOURS,
    }],
  },
  {
    key: 'instagram', kinds: ['crm'], name: 'Leads de Instagram', icon: 'MessagesSquare',
    pitch: 'Un asistente contesta comentarios, historias y mensajes, cualifica al lead y le da cita o le guarda la reserva. Por la mañana los tienes en la bandeja.',
    entities: ['conversacion'],
    views: [{
      key: 'instagram', label: 'Bandeja de Instagram', type: 'worklist', entity: 'conversacion', groupBy: 'estado', columns: ['interes', 'presupuesto', 'zona', 'fechas', 'puntuacion', 'ultima_actividad'],
      actions: [
        { kind: 'link', label: 'Abrir en Instagram', field: 'enlace' },
        { kind: 'move', label: 'Pasar a una persona', to: 'humano', when: ['en_curso', 'cualificado'] },
        { kind: 'schedule', label: 'Agendar', field: 'cita', to: 'agendado', when: ['en_curso', 'cualificado', 'humano'] },
        { kind: 'move', label: 'Descartar', to: 'descartado', when: ['en_curso', 'cualificado', 'humano'] },
        { kind: 'move', label: 'Recuperar', to: 'humano', when: ['descartado'] },
      ],
      availability: HOURS,
    }],
  },
  {
    key: 'operaciones_inmo', kinds: ['crm'], name: 'Operaciones', icon: 'Filter',
    pitch: 'Compradores, vendedores, captación y alquileres por etapas, con importe y comisión.',
    entities: ['operacion'],
    views: [{ key: 'pipeline', label: 'Operaciones', type: 'kanban', entity: 'operacion', groupBy: 'etapa', sumField: 'importe' }],
  },
  {
    key: 'cartera', kinds: ['crm'], name: 'Cartera de inmuebles', icon: 'Building2',
    pitch: 'Venta, alquiler y turísticos en fichas con foto, precio, estado y agente.',
    entities: ['inmueble'],
    views: [{ key: 'cartera', label: 'Inmuebles', type: 'cards', entity: 'inmueble', imageField: 'foto', groupBy: 'estado', columns: ['operacion', 'precio', 'zona', 'habitaciones', 'metros', 'agente'] }],
  },
  {
    key: 'agenda_inmo', kinds: ['crm'], name: 'Agenda', icon: 'CalendarDays',
    pitch: 'Visitas, captaciones, tasaciones y firmas de todo el equipo.',
    entities: ['cita_inmo'],
    views: [{ key: 'agenda_inmo', label: 'Agenda', type: 'calendar', entity: 'cita_inmo', dateField: 'cuando' }],
  },
  {
    key: 'turistico', kinds: ['crm'], name: 'Alquiler turístico', icon: 'Palmtree',
    pitch: 'Calendario de reservas por alojamiento, ingresos netos, limpiezas e incidencias. Airbnb y Booking por iCal.',
    entities: ['reserva', 'servicio', 'incidencia'],
    views: [
      { key: 'calendario', label: 'Calendario', type: 'timeline', entity: 'reserva', rowField: 'alojamiento', startField: 'entrada', endField: 'salida', groupBy: 'canal' },
      { key: 'reservas', label: 'Reservas', type: 'table', entity: 'reserva', columns: ['huesped', 'alojamiento', 'canal', 'entrada', 'salida', 'estado', 'importe', 'pago'] },
      {
        key: 'limpiezas', label: 'Limpiezas y tareas', type: 'worklist', entity: 'servicio', groupBy: 'estado', columns: ['tipo', 'alojamiento', 'fecha', 'responsable'],
        actions: [
          { kind: 'move', label: 'Asignar', to: 'asignada', when: ['pendiente'] },
          { kind: 'move', label: 'Hecha', to: 'hecha', when: ['pendiente', 'asignada', 'problema'] },
          { kind: 'move', label: 'Hay un problema', to: 'problema', when: ['pendiente', 'asignada'] },
          { kind: 'move', label: 'Reabrir', to: 'pendiente', when: ['hecha'] },
        ],
      },
      {
        key: 'incidencias', label: 'Incidencias', type: 'worklist', entity: 'incidencia', groupBy: 'estado', columns: ['alojamiento', 'prioridad', 'responsable', 'abierta'],
        actions: [
          { kind: 'move', label: 'Empezar', to: 'en_curso', when: ['abierta'] },
          { kind: 'move', label: 'Resuelta', to: 'resuelta', when: ['abierta', 'en_curso'] },
          { kind: 'move', label: 'Reabrir', to: 'abierta', when: ['resuelta'] },
        ],
      },
    ],
  },
  {
    key: 'equipo', kinds: ['crm'], name: 'Equipo', icon: 'UserRound',
    pitch: 'Agentes, limpieza y mantenimiento: a quién se asigna cada cosa.',
    entities: ['persona'],
    views: [{ key: 'agentes', label: 'Equipo', type: 'table', entity: 'persona', columns: ['nombre', 'puesto', 'area', 'telefono', 'email'] }],
  },
  {
    key: 'analisis', kinds: ['crm', 'erp'], name: 'Análisis de datos', icon: 'BrainCircuit',
    pitch: 'Puntúa tus leads, prevé lo que vas a cerrar y te dice qué tipo de cliente se gana y cuál se pierde.',
    entities: [],
    views: [{ key: 'analisis', label: 'Análisis', type: 'analysis', analysis: DEFAULT_ANALYSIS }],
  },
  {
    key: 'panel', kinds: ['crm', 'erp'], name: 'Cifras clave', icon: 'Gauge',
    pitch: 'Los números importantes de todo lo que añadas, arriba del todo.',
    entities: [],
    views: [{ key: 'panel', label: 'Cifras', type: 'dashboard', widgets: [] }],
  },
];

export const STARTER: Record<AppKind, string[]> = {
  crm: ['panel', 'analisis', 'leads', 'embudo', 'agenda', 'clientes', 'operaciones'],
  erp: ['panel', 'analisis', 'facturas', 'pedidos', 'inventario', 'clientes', 'operaciones'],
};

// Widgets each entity contributes to the "Cifras clave" panel.
// What the agency does decides the pieces it starts with. Everything is one
// app: the same contacts, properties and team serve sales and tourist rentals.
export type PackKey = 'compraventa' | 'turistico' | 'ambos';
export const PACKS: { key: PackKey; name: string; pitch: string; modules: string[] }[] = [
  { key: 'compraventa', name: 'Compraventa', pitch: 'Captación, compradores, vendedores, visitas y cierres.', modules: ['centro', 'contactos_inmo', 'instagram', 'operaciones_inmo', 'cartera', 'agenda_inmo', 'equipo', 'analisis', 'documentos'] },
  { key: 'turistico', name: 'Alquiler turístico', pitch: 'Reservas de Airbnb y Booking, calendario, limpiezas e ingresos.', modules: ['centro', 'turistico', 'cartera', 'contactos_inmo', 'instagram', 'equipo', 'analisis'] },
  { key: 'ambos', name: 'Las dos cosas', pitch: 'Vendes, alquilas y gestionas pisos turísticos.', modules: ['centro', 'contactos_inmo', 'instagram', 'operaciones_inmo', 'cartera', 'agenda_inmo', 'turistico', 'equipo', 'analisis', 'documentos'] },
];
// The pieces an agency picks from; the older generic ones stay available under «Más piezas».
const AGENCY = ['centro', 'contactos_inmo', 'instagram', 'operaciones_inmo', 'cartera', 'agenda_inmo', 'turistico', 'equipo', 'analisis', 'documentos', 'automatizaciones', 'gastos'];
export const agencyModules = () => AGENCY.map((k) => MODULES.find((m) => m.key === k)!);
export const extraModules = () => MODULES.filter((m) => !AGENCY.includes(m.key));
export const composePack = (pack: PackKey, name: string) => composeApp('crm', name, PACKS.find((p) => p.key === pack)?.modules ?? PACKS[2].modules);

const PANEL: Record<string, DashboardWidget[]> = {
  lead: [{ kind: 'metric', label: 'Leads', entity: 'lead', agg: 'count' }, { kind: 'bars', label: 'Leads por estado', entity: 'lead', agg: 'count', groupBy: 'estado' }],
  oportunidad: [{ kind: 'metric', label: 'En el embudo', entity: 'oportunidad', agg: 'sum', field: 'importe' }, { kind: 'bars', label: 'Importe por etapa', entity: 'oportunidad', agg: 'sum', field: 'importe', groupBy: 'etapa' }],
  presupuesto: [{ kind: 'metric', label: 'Presupuestado', entity: 'presupuesto', agg: 'sum', field: 'base' }],
  ticket: [{ kind: 'bars', label: 'Incidencias por estado', entity: 'ticket', agg: 'count', groupBy: 'estado' }],
  factura: [{ kind: 'metric', label: 'Facturado', entity: 'factura', agg: 'sum', field: 'total' }, { kind: 'bars', label: 'Cobros', entity: 'factura', agg: 'sum', field: 'total', groupBy: 'cobro' }],
  pedido: [{ kind: 'metric', label: 'Pedidos', entity: 'pedido', agg: 'count' }, { kind: 'bars', label: 'Pedidos por estado', entity: 'pedido', agg: 'count', groupBy: 'estado' }],
  producto: [{ kind: 'metric', label: 'Unidades en stock', entity: 'producto', agg: 'sum', field: 'stock' }],
  compra: [{ kind: 'metric', label: 'Compras', entity: 'compra', agg: 'sum', field: 'importe' }],
  proyecto: [{ kind: 'metric', label: 'En proyectos', entity: 'proyecto', agg: 'sum', field: 'presupuesto' }],
  gasto: [{ kind: 'metric', label: 'Gastos', entity: 'gasto', agg: 'sum', field: 'importe' }, { kind: 'bars', label: 'Gastos por categoría', entity: 'gasto', agg: 'sum', field: 'importe', groupBy: 'categoria' }],
  cliente: [{ kind: 'metric', label: 'Clientes', entity: 'cliente', agg: 'count' }],
  cita: [{ kind: 'metric', label: 'Citas', entity: 'cita', agg: 'count' }],
  tarea: [{ kind: 'metric', label: 'Tareas', entity: 'tarea', agg: 'count' }, { kind: 'bars', label: 'Tareas por estado', entity: 'tarea', agg: 'count', groupBy: 'estado' }],
  inmueble: [{ kind: 'metric', label: 'En cartera', entity: 'inmueble', agg: 'sum', field: 'precio' }, { kind: 'bars', label: 'Inmuebles por estado', entity: 'inmueble', agg: 'count', groupBy: 'estado' }],
  visita: [{ kind: 'metric', label: 'Visitas', entity: 'visita', agg: 'count' }],
  movimiento: [{ kind: 'bars', label: 'Movimientos por tipo', entity: 'movimiento', agg: 'sum', field: 'cantidad', groupBy: 'tipo' }],
  operacion: [{ kind: 'metric', label: 'En operaciones', entity: 'operacion', agg: 'sum', field: 'importe' }, { kind: 'bars', label: 'Operaciones por etapa', entity: 'operacion', agg: 'count', groupBy: 'etapa' }],
  reserva: [{ kind: 'metric', label: 'Reservado', entity: 'reserva', agg: 'sum', field: 'importe' }, { kind: 'bars', label: 'Ingresos por canal', entity: 'reserva', agg: 'sum', field: 'importe', groupBy: 'canal' }],
  contacto_inmo: [{ kind: 'metric', label: 'Contactos', entity: 'contacto_inmo', agg: 'count' }, { kind: 'bars', label: 'Por temperatura', entity: 'contacto_inmo', agg: 'count', groupBy: 'temperatura' }],
  conversacion: [{ kind: 'metric', label: 'Conversaciones de Instagram', entity: 'conversacion', agg: 'count' }, { kind: 'bars', label: 'Instagram por estado', entity: 'conversacion', agg: 'count', groupBy: 'estado' }],
  contacto: [{ kind: 'metric', label: 'Contactos', entity: 'contacto', agg: 'count' }, { kind: 'bars', label: 'Consentimiento RGPD', entity: 'contacto', agg: 'count', groupBy: 'consentimiento' }],
};

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const getModule = (key: string) => MODULES.find((m) => m.key === key);
// Order of the cards and of the panels on the page: what each kind of business looks at first.
const ORDER: Record<AppKind, string[]> = {
  crm: ['centro', 'contactos_inmo', 'instagram', 'operaciones_inmo', 'cartera', 'agenda_inmo', 'turistico', 'equipo', 'panel', 'analisis', 'leads', 'inmuebles', 'visitas', 'embudo', 'agenda', 'contactos', 'clientes', 'presupuestos', 'soporte', 'operaciones', 'proyectos', 'documentos', 'automatizaciones', 'facturas', 'pedidos', 'inventario', 'movimientos', 'compras', 'gastos'],
  erp: ['panel', 'analisis', 'facturas', 'pedidos', 'inventario', 'movimientos', 'clientes', 'compras', 'gastos', 'operaciones', 'presupuestos', 'proyectos', 'contactos', 'documentos', 'automatizaciones', 'agenda', 'leads', 'embudo', 'inmuebles', 'visitas', 'soporte', 'centro', 'contactos_inmo', 'instagram', 'operaciones_inmo', 'cartera', 'agenda_inmo', 'turistico', 'equipo'],
};
const rankIn = (kind: AppKind, key: string) => { const i = ORDER[kind].indexOf(key); return i < 0 ? ORDER[kind].length : i; };
export const modulesFor = (kind: AppKind) => MODULES.filter((m) => m.kinds.includes(kind)).sort((a, b) => rankIn(kind, a.key) - rankIn(kind, b.key));
export const otherModules = (kind: AppKind) => MODULES.filter((m) => !m.kinds.includes(kind)).sort((a, b) => rankIn(kind, a.key) - rankIn(kind, b.key));

// Entities a set of keys needs, following relations (pedido → cliente).
function withDependencies(keys: string[]): string[] {
  const out = new Set<string>();
  const visit = (k: string) => {
    if (out.has(k) || !LIBRARY[k]) return;
    out.add(k);
    for (const f of LIBRARY[k].fields) if (f.type === 'relation' && f.relation) visit(f.relation);
  };
  keys.forEach(visit);
  return [...out];
}

export function emptyBlueprint(kind: AppKind, name: string, sector?: string): Blueprint {
  const bp: Blueprint = { version: 1, name, kind, modules: [], entities: [], views: [] };
  if (getSector(sector)) bp.sector = sector;
  return bp;
}

// The sector's extra fields go on every entity that has none of them yet
// (before the notes, which stay last), and anything they link to comes along.
// Screens that were just added take the sector's columns.
function applySector(bp: Blueprint, newViews: string[] = []) {
  const sector = getSector(bp.sector);
  if (!sector) return;
  for (let pass = 0; pass < 5; pass++) {
    for (const e of bp.entities) {
      for (const f of sector.fields[e.key] ?? []) {
        if (e.fields.some((x) => x.key === f.key)) continue;
        const notes = e.fields.findIndex((x) => x.type === 'longtext');
        e.fields.splice(notes < 0 ? e.fields.length : notes, 0, clone(f));
      }
    }
    const missing = withDependencies(bp.entities.flatMap((e) => e.fields.filter((f) => f.type === 'relation').map((f) => f.relation ?? ''))).filter((k) => !bp.entities.some((e) => e.key === k));
    if (missing.length === 0) break;
    for (const k of missing) bp.entities.push(clone(LIBRARY[k]));
  }
  for (const v of bp.views) {
    const cols = sector.columns?.[v.key];
    const e = bp.entities.find((x) => x.key === v.entity);
    if (cols && newViews.includes(v.key) && e && cols.every((c) => e.fields.some((f) => f.key === c))) v.columns = [...cols];
  }
}

function rebuildPanel(bp: Blueprint) {
  const panel = bp.views.find((v) => v.key === 'panel' && v.type === 'dashboard');
  if (!panel) return;
  const present = new Set(bp.entities.map((e) => e.key));
  // Figures follow the kind's order too: an ERP leads with what was invoiced, a CRM with its leads.
  const order = ORDER[bp.kind ?? 'crm'].flatMap((k) => getModule(k)?.entities ?? []);
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? order.length : i; };
  const all = Object.entries(PANEL).filter(([k]) => present.has(k)).sort(([a], [b]) => rank(a) - rank(b)).flatMap(([, w]) => w)
    // Only keep widgets whose fields still exist (the person may have edited the entity).
    .filter((w) => { const e = bp.entities.find((x) => x.key === w.entity)!; return [w.field, w.groupBy].every((k) => !k || e.fields.some((f) => f.key === k)); });
  panel.widgets = [...all.filter((w) => w.kind === 'metric').slice(0, 4), ...all.filter((w) => w.kind === 'bars').slice(0, 3)];
  if (panel.widgets.length === 0) panel.widgets = [{ kind: 'metric', label: bp.entities[0]?.labelPlural ?? 'Registros', entity: bp.entities[0]?.key ?? '', agg: 'count' }];
}

function sortViews(bp: Blueprint) {
  const rank = (v: View) => { const m = MODULES.find((x) => x.views.some((y) => y.key === v.key)); return m ? rankIn(bp.kind ?? 'crm', m.key) : MODULES.length; };
  bp.views = bp.views.map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map((x) => x.v);
}

export function addModule(current: Blueprint, key: string): Blueprint {
  const m = getModule(key);
  const bp = clone(current);
  if (!m || bp.modules?.includes(key)) return bp;
  for (const k of withDependencies(m.entities)) if (!bp.entities.some((e) => e.key === k)) bp.entities.push(clone(LIBRARY[k]));
  const added = m.views.filter((v) => !bp.views.some((x) => x.key === v.key));
  for (const v of added) bp.views.push(clone(v));
  bp.modules = [...(bp.modules ?? []), key];
  applySector(bp, added.map((v) => v.key));
  sortViews(bp);
  rebuildPanel(bp);
  tidyAnalysis(bp);
  // The Instagram assistant comes with the piece; one you had before comes back as it was.
  if (key === 'instagram') { if (bp.bot) bp.bot.enabled = true; else bp.bot = botTemplate(bp); }
  fitBot(bp);
  return bp;
}

export function removeModule(current: Blueprint, key: string): Blueprint {
  const m = getModule(key);
  const bp = clone(current);
  if (!m || !bp.modules?.includes(key)) return bp;
  bp.modules = bp.modules.filter((k) => k !== key);
  const otherViews = new Set(bp.modules.flatMap((k) => getModule(k)?.views.map((v) => v.key) ?? []));
  bp.views = bp.views.filter((v) => !m.views.some((x) => x.key === v.key) || otherViews.has(v.key));
  // Keep an entity while a remaining screen, module or relation still needs it.
  const needed = new Set(withDependencies([
    ...bp.modules.flatMap((k) => getModule(k)?.entities ?? []),
    // The house panel is rebuilt from what is left, so its figures don't hold entities back.
    ...bp.views.flatMap((v) => [v.entity ?? '', ...(v.key === 'panel' ? [] : v.widgets?.map((w) => w.entity) ?? [])]),
  ]));
  for (const e of bp.entities) for (const f of e.fields) if (f.type === 'relation' && f.relation && needed.has(e.key)) needed.add(f.relation);
  bp.entities = bp.entities.filter((e) => needed.has(e.key) || !LIBRARY[e.key]);
  rebuildPanel(bp);
  tidyAnalysis(bp);
  // Removing the piece switches the assistant off but keeps how you set it up.
  if (key === 'instagram' && bp.bot) bp.bot.enabled = false;
  fitBot(bp);
  return bp;
}

export function composeApp(kind: AppKind, name: string, modules: string[], sector?: string): Blueprint {
  return modules.reduce((bp, k) => addModule(bp, k), emptyBlueprint(kind, name, sector));
}

// ---- Sample data, so a freshly built app is never empty ----

const rel = (days: number, time?: string) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return time ? `${day}T${time}` : day;
};

// Last night's Instagram: before midnight is yesterday, after it is today.
const dm = (day: string) => `${Number(day.slice(8, 10))}/${Number(day.slice(5, 7))}`;
const night = (time: string) => rel(Number(time.slice(0, 2)) >= 18 ? -1 : 0, time);
// A short transcript: [hour, 0 = the lead / 1 = the assistant, text].
const chat = (user: string, lines: [string, 0 | 1, string][]) => lines.map(([t, who, text]) => `[${t}] ${who ? 'Asistente' : user}: ${text}`).join('\n');
const HELLO = '¡Hola! 👋 Soy el asistente de la inmobiliaria. Te hago cuatro preguntas rápidas y te busco un hueco para verlo.';
const STAY = '¡Hola! 👋 Soy el asistente. Reservando directo no pagas comisiones de plataforma. Te miro la disponibilidad en un momento.';
const IG_VISIT = ['conversacion', 'cita_inmo'];
const IG_STAY = ['conversacion', 'reserva'];
const IG = ['conversacion'];

const SAMPLES: Record<string, Record<string, unknown>[]> = {
  cliente: [
    { id: 'm-cl1', nombre: 'Marta Ibáñez', empresa: 'Floristería Azahar', telefono: '612 330 118', email: 'marta@azahar.es', nif: 'B46123456', tipo: 'habitual' },
    { id: 'm-cl2', nombre: 'Jorge Sanz', empresa: 'Talleres Sanz SL', telefono: '963 220 410', email: 'jorge@tallersanz.es', nif: 'B46987654', tipo: 'vip' },
    { id: 'm-cl3', nombre: 'Ana Belda', empresa: 'Estudio Belda', telefono: '655 781 902', email: 'ana@belda.studio', tipo: 'nuevo' },
    { id: 'm-cl4', nombre: 'Rafael Costa', empresa: 'Bar El Puerto', telefono: '644 019 233', email: 'rafa@barelpuerto.es', nif: 'B12443210', tipo: 'habitual' },
  ],
  lead: [
    { id: 'm-l1', nombre: 'Clara Vidal', telefono: '611 402 887', email: 'clara.vidal@correo.es', origen: 'instagram', entrada: rel(-1), interes: 'Pack mensual', valor: 1200, estado: 'nuevo' },
    { id: 'm-l2', nombre: 'Hugo Ferrer', telefono: '677 993 120', origen: 'whatsapp', entrada: rel(-11), interes: 'Presupuesto reforma', valor: 8400, estado: 'contactado' },
    { id: 'm-l3', nombre: 'Nerea Gil', telefono: '622 118 540', email: 'nerea@correo.es', origen: 'web', entrada: rel(-4), interes: 'Demo del servicio', valor: 2500, estado: 'cita', cita: rel(0, '17:00') },
    { id: 'm-l4', nombre: 'Pablo Ruiz', telefono: '690 551 002', origen: 'recomendacion', entrada: rel(-6), interes: 'Contrato anual', valor: 6000, estado: 'cita', cita: rel(-1, '10:00') },
    { id: 'm-l5', nombre: 'Lidia Mas', telefono: '633 207 441', origen: 'llamada', entrada: rel(-20), interes: 'Información general', valor: 300, estado: 'ganado' },
    // History, so the analysis has won and lost cases to learn from.
    { id: 'm-l6', nombre: 'Óscar Navarro', telefono: '644 870 215', origen: 'recomendacion', entrada: rel(-35), interes: 'Contrato anual', valor: 4200, estado: 'ganado' },
    { id: 'm-l7', nombre: 'Teresa Gómez', telefono: '611 093 662', origen: 'recomendacion', entrada: rel(-28), interes: 'Pack trimestral', valor: 3100, estado: 'ganado' },
    { id: 'm-l8', nombre: 'Iker Sala', origen: 'instagram', entrada: rel(-30), interes: 'Pack mensual', valor: 900, estado: 'perdido', motivo: 'precio' },
    { id: 'm-l9', nombre: 'Rocío Pardo', email: 'rocio.pardo@correo.es', origen: 'instagram', entrada: rel(-24), interes: 'Información general', valor: 650, estado: 'perdido', motivo: 'no_responde' },
    { id: 'm-l10', nombre: 'Daniel Ortiz', telefono: '655 310 908', origen: 'web', entrada: rel(-18), interes: 'Presupuesto reforma', valor: 1800, estado: 'perdido', motivo: 'precio' },
    { id: 'm-l11', nombre: 'Paula Esteve', telefono: '622 774 130', email: 'paula@esteve.es', origen: 'web', entrada: rel(-15), interes: 'Demo del servicio', valor: 2200, estado: 'ganado' },
    { id: 'm-l12', nombre: 'Marcos Vila', telefono: '690 228 471', origen: 'whatsapp', entrada: rel(-12), interes: 'Contrato anual', valor: 5000, estado: 'perdido', motivo: 'competencia' },
  ],
  oportunidad: [
    { id: 'm-o1', titulo: 'Renovación Talleres Sanz', cliente: 'm-cl2', etapa: 'negociacion', importe: 14500, probabilidad: 70, cierre: rel(12) },
    { id: 'm-o2', titulo: 'Web Floristería Azahar', cliente: 'm-cl1', etapa: 'propuesta', importe: 3200, probabilidad: 50, cierre: rel(20) },
    { id: 'm-o3', titulo: 'Carta digital Bar El Puerto', cliente: 'm-cl4', etapa: 'nueva', importe: 900, probabilidad: 20, cierre: rel(30) },
    { id: 'm-o4', titulo: 'Branding Estudio Belda', cliente: 'm-cl3', etapa: 'ganada', importe: 4800, probabilidad: 100, cierre: rel(-5) },
    { id: 'm-o5', titulo: 'Tienda online Talleres Sanz', cliente: 'm-cl2', etapa: 'ganada', importe: 7600, probabilidad: 100, cierre: rel(-40) },
    { id: 'm-o6', titulo: 'App de reservas Bar El Puerto', cliente: 'm-cl4', etapa: 'perdida', importe: 2400, probabilidad: 0, cierre: rel(-22) },
    { id: 'm-o7', titulo: 'Mantenimiento Floristería Azahar', cliente: 'm-cl1', etapa: 'perdida', importe: 1500, probabilidad: 0, cierre: rel(-9) },
  ],
  cita: [
    { id: 'm-ci1', asunto: 'Llamada de seguimiento', cliente: 'm-cl2', cuando: rel(0, '12:00'), tipo: 'llamada' },
    { id: 'm-ci2', asunto: 'Reunión propuesta web', cliente: 'm-cl1', cuando: rel(1, '10:00'), tipo: 'reunion' },
    { id: 'm-ci3', asunto: 'Visita al local', cliente: 'm-cl4', cuando: rel(3, '17:00'), tipo: 'visita' },
    { id: 'm-ci4', asunto: 'Videollamada de cierre', cliente: 'm-cl3', cuando: rel(-2, '16:00'), tipo: 'video', hecha: true },
  ],
  presupuesto: [
    { id: 'm-p1', numero: 'PR-2026-031', cliente: 'm-cl1', concepto: 'Web y tienda', fecha: rel(-4), base: 3200, iva: '21', estado: 'enviado' },
    { id: 'm-p2', numero: 'PR-2026-032', cliente: 'm-cl2', concepto: 'Mantenimiento anual', fecha: rel(-2), base: 14500, iva: '21', estado: 'borrador' },
    { id: 'm-p3', numero: 'PR-2026-028', cliente: 'm-cl3', concepto: 'Branding', fecha: rel(-15), base: 4800, iva: '21', estado: 'aceptado' },
  ],
  ticket: [
    { id: 'm-t1', asunto: 'No llega el email de confirmación', cliente: 'm-cl1', telefono: '612 330 118', email: 'marta@azahar.es', prioridad: 'alta', estado: 'abierta', abierta: rel(0) },
    { id: 'm-t2', asunto: 'Cambiar datos de facturación', cliente: 'm-cl2', email: 'jorge@tallersanz.es', prioridad: 'media', estado: 'en_curso', abierta: rel(-1) },
    { id: 'm-t3', asunto: 'Duda sobre la tarifa', cliente: 'm-cl4', telefono: '644 019 233', prioridad: 'baja', estado: 'esperando', abierta: rel(-3) },
  ],
  factura: [
    { id: 'm-f1', numero: 'F-2026-118', cliente: 'm-cl2', email: 'jorge@tallersanz.es', fecha: rel(-10), vence: rel(20), base: 2400, iva: '21', total: 2904, cobro: 'pendiente' },
    { id: 'm-f2', numero: 'F-2026-112', cliente: 'm-cl4', email: 'rafa@barelpuerto.es', fecha: rel(-40), vence: rel(-10), base: 650, iva: '21', total: 786.5, cobro: 'vencida' },
    { id: 'm-f3', numero: 'F-2026-120', cliente: 'm-cl1', email: 'marta@azahar.es', fecha: rel(-3), vence: rel(27), base: 1100, iva: '21', total: 1331, cobro: 'pendiente' },
    { id: 'm-f4', numero: 'F-2026-109', cliente: 'm-cl3', email: 'ana@belda.studio', fecha: rel(-35), vence: rel(-5), base: 4800, iva: '21', total: 5808, cobro: 'cobrada' },
  ],
  producto: [
    { id: 'm-pr1', referencia: 'MAT-010', nombre: 'Caja cartón 40×30', familia: 'material', precio: 1.2, coste: 0.55, stock: 420, minimo: 100 },
    { id: 'm-pr2', referencia: 'CON-220', nombre: 'Cinta adhesiva 50 m', familia: 'consumible', precio: 2.9, coste: 1.1, stock: 35, minimo: 50 },
    { id: 'm-pr3', referencia: 'SER-001', nombre: 'Montaje e instalación', familia: 'servicio', precio: 45, coste: 20, stock: 0, minimo: 0 },
    { id: 'm-pr4', referencia: 'GEN-501', nombre: 'Etiquetas térmicas (rollo)', familia: 'general', precio: 8.5, coste: 3.2, stock: 12, minimo: 20 },
  ],
  pedido: [
    { id: 'm-pe1', numero: 'P-0451', cliente: 'm-cl4', entrega: rel(1), estado: 'preparando', importe: 486 },
    { id: 'm-pe2', numero: 'P-0452', cliente: 'm-cl2', entrega: rel(2), estado: 'recibido', importe: 1920 },
    { id: 'm-pe3', numero: 'P-0449', cliente: 'm-cl1', entrega: rel(0), estado: 'enviado', importe: 312 },
    { id: 'm-pe4', numero: 'P-0447', cliente: 'm-cl3', entrega: rel(-2), estado: 'entregado', importe: 760 },
  ],
  proveedor: [
    { id: 'm-pv1', nombre: 'Embalajes Levante SL', nif: 'B46000111', telefono: '961 554 300', email: 'pedidos@emblevante.es', categoria: 'mercancia' },
    { id: 'm-pv2', nombre: 'Transportes Ribera', nif: 'B46222333', telefono: '962 440 120', categoria: 'transporte' },
  ],
  compra: [
    { id: 'm-co1', numero: 'C-0088', proveedor: 'm-pv1', fecha: rel(-6), importe: 1350, estado: 'recibida' },
    { id: 'm-co2', numero: 'C-0091', proveedor: 'm-pv1', fecha: rel(-1), importe: 620, estado: 'pedida' },
    { id: 'm-co3', numero: 'C-0085', proveedor: 'm-pv2', fecha: rel(-14), importe: 240, estado: 'pagada' },
  ],
  proyecto: [
    { id: 'm-pj1', nombre: 'Web Floristería Azahar', cliente: 'm-cl1', estado: 'en_curso', presupuesto: 3200, entrega: rel(18), avance: 40 },
    { id: 'm-pj2', nombre: 'Branding Estudio Belda', cliente: 'm-cl3', estado: 'revision', presupuesto: 4800, entrega: rel(4), avance: 90 },
    { id: 'm-pj3', nombre: 'Carta digital', cliente: 'm-cl4', estado: 'pendiente', presupuesto: 900, entrega: rel(30), avance: 0 },
  ],
  persona: [
    { id: 'm-pe-1', nombre: 'Laura Martí', puesto: 'Gerente', area: 'administracion', telefono: '600 112 233', email: 'laura@miempresa.es' },
    { id: 'm-pe-2', nombre: 'Iván Soler', puesto: 'Comercial', area: 'ventas', telefono: '600 445 566', email: 'ivan@miempresa.es' },
    { id: 'm-pe-3', nombre: 'Sara Peris', puesto: 'Operaciones', area: 'operaciones', telefono: '600 778 899', email: 'sara@miempresa.es' },
    { id: 'm-pe-4', nombre: 'Rosa Gil', puesto: 'Limpieza y check-in', area: 'operaciones', telefono: '600 334 455', email: 'rosa@miempresa.es' },
  ],
  proceso: [
    { id: 'm-ps1', nombre: 'Alta de cliente nuevo', area: 'ventas', estado: 'activo', frecuencia: 'cada_cliente', pasos: 'Pedir NIF y datos de facturación\nEnviar contrato para firmar\nDar de alta en facturación\nLlamada de bienvenida' },
    { id: 'm-ps2', nombre: 'Cierre de mes', area: 'administracion', estado: 'activo', frecuencia: 'mensual', pasos: 'Revisar facturas pendientes de cobro\nPasar gastos a la gestoría\nConciliar el banco' },
    { id: 'm-ps3', nombre: 'Apertura del local', area: 'operaciones', estado: 'borrador', frecuencia: 'diario', pasos: 'Encender equipos\nRevisar la agenda del día\nContestar mensajes de la noche' },
  ],
  tarea: [
    { id: 'm-ta1', titulo: 'Enviar contrato a Talleres Sanz', estado: 'en_curso', responsable: 'm-pe-2', proceso: 'm-ps1', prioridad: 'alta', limite: rel(1) },
    { id: 'm-ta2', titulo: 'Pasar gastos a la gestoría', estado: 'pendiente', responsable: 'm-pe-1', proceso: 'm-ps2', prioridad: 'media', limite: rel(4) },
    { id: 'm-ta3', titulo: 'Revisar la caldera del almacén', estado: 'bloqueada', responsable: 'm-pe-3', prioridad: 'media', limite: rel(-1), notas: 'Esperando al técnico' },
    { id: 'm-ta4', titulo: 'Llamada de bienvenida a Estudio Belda', estado: 'hecha', responsable: 'm-pe-2', proceso: 'm-ps1', prioridad: 'baja', limite: rel(-3) },
  ],
  documento: [
    { id: 'm-d1', titulo: 'Contrato de mantenimiento (plantilla)', tipo: 'plantilla', area: 'ventas', enlace: 'https://drive.google.com/', version: 'v3' },
    { id: 'm-d2', titulo: 'Seguro de responsabilidad civil', tipo: 'legal', area: 'administracion', enlace: 'https://drive.google.com/', caduca: rel(25) },
    { id: 'm-d3', titulo: 'Manual de bienvenida al equipo', tipo: 'manual', area: 'personas', enlace: 'https://drive.google.com/', version: '2026' },
    { id: 'm-d4', titulo: 'Tarifas Embalajes Levante', tipo: 'proveedor', area: 'operaciones', enlace: 'https://drive.google.com/', caduca: rel(-4) },
  ],
  automatizacion: [
    { id: 'm-au1', nombre: 'Lead nuevo → aviso al comercial', seccion: 'Leads', evento: 'alta', url: 'https://tu-n8n.ejemplo.com/webhook/lead-nuevo', estado: 'pausada' },
    { id: 'm-au2', nombre: 'Factura cobrada → contabilidad', seccion: 'Facturas', evento: 'cambio', estado_destino: 'Cobrada', url: 'https://tu-n8n.ejemplo.com/webhook/cobro', estado: 'pausada' },
  ],
  inmueble: [
    { id: 'm-in1', agente: 'm-pe-2', referencia: 'V-1043', direccion: 'C/ Sueca 41, 3.º', tipo: 'piso', operacion: 'venta', estado: 'disponible', precio: 215000, metros: 88, habitaciones: 3, banos: 1, zona: 'Ruzafa', certificado: 'd', exclusiva: true, propietario: 'm-cl1', captado: rel(-21) },
    { id: 'm-in2', agente: 'm-pe-2', referencia: 'A-0388', direccion: 'Av. Primado Reig 112', tipo: 'piso', operacion: 'alquiler', estado: 'reservado', precio: 1050, metros: 95, habitaciones: 3, banos: 2, zona: 'Benimaclet', certificado: 'c', propietario: 'm-cl4', captado: rel(-9) },
    { id: 'm-in3', agente: 'm-pe-1', referencia: 'V-1051', direccion: 'C/ Mayor 8, Godella', tipo: 'casa', operacion: 'venta', estado: 'captacion', precio: 435000, metros: 210, habitaciones: 4, banos: 3, zona: 'Godella', certificado: 'tramite', captado: rel(-2) },
    { id: 'm-in4', agente: 'm-pe-1', referencia: 'V-0997', direccion: 'Plaza Redonda 3, ático', tipo: 'atico', operacion: 'venta', estado: 'vendido', precio: 330000, metros: 104, habitaciones: 2, banos: 2, zona: 'Centro', certificado: 'e', exclusiva: true, captado: rel(-80) },
    { id: 'm-in5', referencia: 'T-01', direccion: 'Apartamento Malvarrosa Sol · C/ Pavía 12', tipo: 'piso', operacion: 'turistico', estado: 'disponible', zona: 'Malvarrosa', habitaciones: 2, banos: 1, metros: 64, capacidad: 4, licencia: 'VT-48211-V', precio_noche: 118, tarifa_limpieza: 45, agente: 'm-pe-3', airbnb_url: 'https://www.airbnb.es/rooms/demo-malvarrosa' },
    { id: 'm-in6', referencia: 'T-02', direccion: 'Loft Carmen · C/ Quart 40', tipo: 'piso', operacion: 'turistico', estado: 'disponible', zona: 'El Carmen', habitaciones: 1, banos: 1, metros: 48, capacidad: 2, licencia: 'VT-50170-V', precio_noche: 95, tarifa_limpieza: 35, agente: 'm-pe-3', booking_url: 'https://www.booking.com/hotel/es/demo-loft-carmen.html' },
    { id: 'm-in7', referencia: 'T-03', direccion: 'Ático Ruzafa Terraza · C/ Cádiz 77', tipo: 'atico', operacion: 'turistico', estado: 'disponible', zona: 'Ruzafa', habitaciones: 3, banos: 2, metros: 92, capacidad: 6, licencia: 'VT-47002-V', precio_noche: 165, tarifa_limpieza: 60, agente: 'm-pe-3' },
    { id: 'm-in8', referencia: 'T-04', direccion: 'Casa Patacona Playa · Av. Mare Nostrum 5', tipo: 'casa', operacion: 'turistico', estado: 'disponible', zona: 'Patacona', habitaciones: 4, banos: 3, metros: 140, capacidad: 8, licencia: 'VT-52990-V', precio_noche: 240, tarifa_limpieza: 80, agente: 'm-pe-1' },
  ],
  visita: [
    { id: 'm-vi1', titulo: 'Visita V-1043', inmueble: 'm-in1', lead: 'm-l1', cuando: rel(1, '18:00'), resultado: 'pendiente' },
    { id: 'm-vi2', titulo: 'Visita A-0388', inmueble: 'm-in2', lead: 'm-l2', cuando: rel(-2, '12:30'), resultado: 'oferta' },
    { id: 'm-vi3', titulo: 'Segunda visita V-1043', inmueble: 'm-in1', lead: 'm-l4', cuando: rel(-5, '17:00'), resultado: 'no_encaja', notas: 'Busca algo con terraza.' },
  ],
  movimiento: [
    { id: 'm-mv1', concepto: 'Recepción compra C-0088', producto: 'm-pr1', tipo: 'entrada', cantidad: 300, fecha: rel(-6), lote: 'L-2609' },
    { id: 'm-mv2', concepto: 'Pedido P-0447', producto: 'm-pr1', tipo: 'salida', cantidad: 80, fecha: rel(-2) },
    { id: 'm-mv3', concepto: 'Recuento mensual', producto: 'm-pr2', tipo: 'ajuste', cantidad: -5, fecha: rel(-1), motivo: 'Rotas en el almacén' },
    { id: 'm-mv4', concepto: 'Devolución Bar El Puerto', producto: 'm-pr4', tipo: 'devolucion', cantidad: 2, fecha: rel(0) },
  ],
  contacto: [
    { id: 'm-ct1', nombre: 'Marta', apellidos: 'Ibáñez', email: 'marta@azahar.es', telefono: '612 330 118', empresa: 'Floristería Azahar', provincia: 'Valencia', idioma: 'es', fuente: 'formulario', consentimiento: 'si', consentimiento_fecha: rel(-120), base_legal: 'consentimiento', verificado: rel(-30), estado: 'valido' },
    { id: 'm-ct2', nombre: 'Marta', apellidos: 'Ibáñez Roig', email: 'Marta@Azahar.es', empresa: 'Floristeria Azahar', fuente: 'importacion', consentimiento: 'pendiente', estado: 'revisar' },
    { id: 'm-ct3', nombre: 'Jorge', apellidos: 'Sanz', email: 'jorge@tallersanz.es', telefono: '963 220 410', empresa: 'Talleres Sanz SL', cargo: 'Gerente', provincia: 'Valencia', idioma: 'ca', fuente: 'compra', consentimiento: 'si', consentimiento_fecha: rel(-300), base_legal: 'contrato', verificado: rel(-200), estado: 'valido' },
    { id: 'm-ct4', nombre: 'Laia', apellidos: 'Puig', email: 'laia.puig@correo.cat', fuente: 'evento', consentimiento: 'si', consentimiento_fecha: rel(-15), base_legal: 'consentimiento', estado: 'valido', etiquetas: 'feria, newsletter' },
    { id: 'm-ct5', nombre: 'Andrés', apellidos: 'Molina', email: 'andres@molina-old.es', telefono: '+34 655 781 902', fuente: 'importacion', consentimiento: 'no', estado: 'rebotado' },
    { id: 'm-ct6', nombre: 'Ana', apellidos: 'Belda', email: 'ana@belda.studio', telefono: '655781902', empresa: 'Estudio Belda', fuente: 'referido', consentimiento: 'pendiente', estado: 'revisar' },
  ],
  contacto_inmo: [
    { id: 'm-ki1', nombre: 'Clara', apellidos: 'Vidal', telefono: '611 402 887', email: 'clara.vidal@correo.es', tipo: 'comprador', temperatura: 'caliente', proxima_accion: 'Enseñarle V-1043 con su pareja', seguimiento: rel(1, '18:00'), presupuesto: 230000, zonas: 'Ruzafa, Ensanche', tipo_deseado: 'piso', habitaciones_min: 3, metros_min: 80, origen: 'idealista', agente: 'm-pe-2', prioridad: 'alta', alta: rel(-6) },
    { id: 'm-ki2', nombre: 'Hugo', apellidos: 'Ferrer', telefono: '677 993 120', email: 'hugo.ferrer@correo.es', tipo: 'arrendatario', temperatura: 'templado', proxima_accion: 'Mandar contrato de alquiler', seguimiento: rel(0, '12:00'), presupuesto: 1100, zonas: 'Benimaclet', tipo_deseado: 'piso', habitaciones_min: 3, origen: 'fotocasa', agente: 'm-pe-2', prioridad: 'media', alta: rel(-14) },
    { id: 'm-ki3', nombre: 'Pilar', apellidos: 'Navarro', telefono: '622 118 450', email: 'pilar.navarro@correo.es', tipo: 'vendedor', temperatura: 'caliente', proxima_accion: 'Tasación y propuesta de exclusiva', seguimiento: rel(2, '10:00'), zonas: 'Godella', origen: 'cartel', agente: 'm-pe-1', prioridad: 'alta', alta: rel(-3) },
    { id: 'm-ki4', nombre: 'Tomás', apellidos: 'Ribes', telefono: '633 870 214', email: 'tomas@ribesinversiones.es', tipo: 'inversor', temperatura: 'templado', proxima_accion: 'Enviar 3 pisos con rentabilidad turística', seguimiento: rel(-2, '09:30'), presupuesto: 400000, zonas: 'Ruzafa, El Carmen, Malvarrosa', tipo_deseado: 'piso', origen: 'recomendacion', agente: 'm-pe-1', prioridad: 'alta', alta: rel(-30) },
    { id: 'm-ki5', nombre: 'Lucía', apellidos: 'Moreno', telefono: '644 556 019', email: 'lucia.moreno@correo.es', tipo: 'propietario', temperatura: 'cerrado', proxima_accion: 'Liquidación mensual del T-01', zonas: 'Malvarrosa', origen: 'web', agente: 'm-pe-3', alta: rel(-200) },
    { id: 'm-ki6', nombre: 'Javier', apellidos: 'Cano', telefono: '655 210 734', email: 'javi.cano@correo.es', tipo: 'comprador', temperatura: 'frio', proxima_accion: 'Llamar cuando tenga la hipoteca', seguimiento: rel(-9, '17:00'), presupuesto: 180000, zonas: 'Campanar', tipo_deseado: 'piso', habitaciones_min: 2, origen: 'instagram', agente: 'm-pe-2', prioridad: 'baja', alta: rel(-40) },
    { id: 'm-ki7', nombre: 'Elena', apellidos: 'Sorní', telefono: '666 902 381', email: 'elena.sorni@correo.es', tipo: 'comprador', temperatura: 'descartado', proxima_accion: 'Compró con otra agencia', presupuesto: 300000, zonas: 'Centro', tipo_deseado: 'atico', origen: 'idealista', agente: 'm-pe-1', alta: rel(-90) },
    { id: 'm-ki8', nombre: 'Marc', apellidos: 'Albert', telefono: '677 440 128', email: 'marc.albert@correo.es', tipo: 'comprador', temperatura: 'cerrado', proxima_accion: 'Firmó Plaza Redonda 3', presupuesto: 340000, zonas: 'Centro', tipo_deseado: 'atico', origen: 'fotocasa', agente: 'm-pe-1', alta: rel(-120) },
    { id: 'm-ki9', nombre: 'Sofía', apellidos: 'Llorens', telefono: '688 330 915', email: 'sofia.llorens@correo.es', tipo: 'propietario', temperatura: 'templado', proxima_accion: 'Propuesta de gestión turística de su casa', seguimiento: rel(3, '11:00'), zonas: 'Patacona', origen: 'llamada', agente: 'm-pe-3', prioridad: 'media', alta: rel(-8) },
    // Last night's Instagram leads (the assistant created them).
    { id: 'm-ki10', _needs: IG_VISIT, nombre: 'Marta', apellidos: 'García', telefono: '611 220 931', tipo: 'comprador', temperatura: 'caliente', proxima_accion: 'Visita mañana a las 10:00', seguimiento: rel(1, '10:00'), presupuesto: 260000, zonas: 'Ruzafa', origen: 'instagram', agente: 'm-pe-2', alta: rel(-1) },
    { id: 'm-ki11', _needs: IG_VISIT, nombre: 'Pau', apellidos: 'Ferrandis', telefono: '644 018 772', tipo: 'vendedor', temperatura: 'caliente', proxima_accion: 'Tasación mañana a las 12:00', seguimiento: rel(1, '12:00'), presupuesto: 320000, zonas: 'Benimaclet', origen: 'instagram', agente: 'm-pe-1', alta: rel(-1) },
    { id: 'm-ki12', _needs: IG_VISIT, nombre: 'Laura', apellidos: 'Ibáñez', telefono: '622 901 455', tipo: 'comprador', temperatura: 'caliente', proxima_accion: 'Visita pasado mañana a las 17:00', seguimiento: rel(2, '17:00'), presupuesto: 180000, zonas: 'Campanar', origen: 'instagram', agente: 'm-pe-2', alta: rel(-1) },
    { id: 'm-ki13', _needs: IG_VISIT, nombre: 'Raúl', apellidos: 'Navarro', telefono: '655 300 118', tipo: 'inversor', temperatura: 'caliente', proxima_accion: 'Llamada en 3 días a las 09:00', seguimiento: rel(3, '09:00'), presupuesto: 450000, zonas: 'El Carmen, Ruzafa', origen: 'instagram', agente: 'm-pe-1', alta: rel(-1) },
    { id: 'm-ki14', _needs: IG_STAY, nombre: 'Sophie Martin', email: 'sophie.martin@correo.fr', tipo: 'huesped', temperatura: 'caliente', proxima_accion: 'Confirmar la prerreserva y enviarle la forma de pago', origen: 'instagram', agente: 'm-pe-3', alta: rel(0) },
    { id: 'm-ki15', _needs: IG_STAY, nombre: 'Jonas Keller', email: 'jonas.keller@mail.de', tipo: 'huesped', temperatura: 'cerrado', proxima_accion: 'Reserva confirmada', origen: 'instagram', agente: 'm-pe-3', alta: rel(0) },
    { id: 'm-ki16', _needs: IG, nombre: 'Carlos', apellidos: 'Molina', tipo: 'arrendatario', temperatura: 'templado', proxima_accion: 'Escribirle: no eligió hueco para la visita', presupuesto: 900, zonas: 'Benimaclet', origen: 'instagram', alta: rel(0) },
    { id: 'm-ki17', _needs: IG, nombre: 'Ana Belén', apellidos: 'Ruiz', tipo: 'comprador', temperatura: 'templado', proxima_accion: 'Respondiendo al asistente de Instagram', presupuesto: 150000, origen: 'instagram', alta: rel(0) },
    { id: 'm-ki18', _needs: IG, nombre: 'Nuria', apellidos: 'Sanchis', tipo: 'comprador', temperatura: 'templado', proxima_accion: 'Respondiendo al asistente de Instagram', origen: 'instagram', alta: rel(0) },
    { id: 'm-ki19', _needs: IG, nombre: 'David', apellidos: 'López', tipo: 'arrendatario', temperatura: 'templado', proxima_accion: 'Llamar: pregunta si se admiten perros', origen: 'instagram', prioridad: 'media', alta: rel(0) },
    { id: 'm-ki20', _needs: IG, nombre: 'Elisa', apellidos: 'Martorell', tipo: 'comprador', temperatura: 'descartado', proxima_accion: 'No le interesa (Instagram)', origen: 'instagram', alta: rel(0) },
    { id: 'm-ki21', _needs: IG, nombre: 'Joan', apellidos: 'Peris', temperatura: 'descartado', proxima_accion: 'No le interesa (Instagram)', origen: 'instagram', alta: rel(0) },
  ],
  operacion: [
    { id: 'm-op1', titulo: 'Clara Vidal · V-1043', embudo: 'compradores', etapa: 'visita', contacto: 'm-ki1', inmueble: 'm-in1', importe: 215000, comision: 3, probabilidad: 60, agente: 'm-pe-2', cierre: rel(25) },
    { id: 'm-op2', titulo: 'Hugo Ferrer · A-0388', embudo: 'alquileres', etapa: 'oferta', contacto: 'm-ki2', inmueble: 'm-in2', importe: 1050, comision: 100, probabilidad: 80, agente: 'm-pe-2', cierre: rel(5) },
    { id: 'm-op3', titulo: 'Captación casa Godella', embudo: 'captacion', etapa: 'negociacion', contacto: 'm-ki3', inmueble: 'm-in3', importe: 435000, comision: 3, probabilidad: 50, agente: 'm-pe-1', cierre: rel(12) },
    { id: 'm-op4', titulo: 'Tomás Ribes · cartera turística', embudo: 'compradores', etapa: 'cualificado', contacto: 'm-ki4', importe: 400000, comision: 2.5, probabilidad: 30, agente: 'm-pe-1', cierre: rel(60) },
    { id: 'm-op5', titulo: 'Marc Albert · Plaza Redonda', embudo: 'compradores', etapa: 'cerrada', contacto: 'm-ki8', inmueble: 'm-in4', importe: 330000, comision: 3, probabilidad: 100, agente: 'm-pe-1', cierre: rel(-20) },
    { id: 'm-op6', titulo: 'Elena Sorní · ático Centro', embudo: 'compradores', etapa: 'perdida', contacto: 'm-ki7', importe: 300000, comision: 3, agente: 'm-pe-1', cierre: rel(-35), motivo_perdida: 'otra_agencia' },
    { id: 'm-op7', titulo: 'Javier Cano · piso Campanar', embudo: 'compradores', etapa: 'contactado', contacto: 'm-ki6', importe: 180000, comision: 3, probabilidad: 15, agente: 'm-pe-2', cierre: rel(90) },
    { id: 'm-op8', titulo: 'Gestión turística Casa Patacona', embudo: 'captacion', etapa: 'lead_nuevo', contacto: 'm-ki9', importe: 6000, comision: 20, probabilidad: 40, agente: 'm-pe-3', cierre: rel(15) },
  ],
  cita_inmo: [
    { id: 'm-cv1', titulo: 'Visita V-1043 con Clara', tipo: 'visita', cuando: rel(1, '18:00'), contacto: 'm-ki1', inmueble: 'm-in1', agente: 'm-pe-2', resultado: 'pendiente' },
    { id: 'm-cv2', titulo: 'Tasación casa Godella', tipo: 'tasacion', cuando: rel(2, '10:00'), contacto: 'm-ki3', inmueble: 'm-in3', agente: 'm-pe-1', resultado: 'pendiente' },
    { id: 'm-cv3', titulo: 'Firma alquiler A-0388', tipo: 'firma', cuando: rel(0, '17:30'), contacto: 'm-ki2', inmueble: 'm-in2', agente: 'm-pe-2', resultado: 'pendiente' },
    { id: 'm-cv4', titulo: 'Visita A-0388 con Hugo', tipo: 'visita', cuando: rel(-4, '12:30'), contacto: 'm-ki2', inmueble: 'm-in2', agente: 'm-pe-2', resultado: 'oferta' },
    { id: 'm-cv5', titulo: 'Reunión gestión turística Patacona', tipo: 'captacion', cuando: rel(3, '11:00'), contacto: 'm-ki9', agente: 'm-pe-3', resultado: 'pendiente' },
    { id: 'm-cv6', _needs: IG_VISIT, titulo: 'Visita con Marta García', tipo: 'visita', cuando: rel(1, '10:00'), contacto: 'm-ki10', agente: 'm-pe-2', resultado: 'pendiente', notas: 'Agendada por el asistente de Instagram (@martagarcia.vlc).' },
    { id: 'm-cv7', _needs: IG_VISIT, titulo: 'Tasación con Pau Ferrandis', tipo: 'tasacion', cuando: rel(1, '12:00'), contacto: 'm-ki11', agente: 'm-pe-1', resultado: 'pendiente', notas: 'Agendada por el asistente de Instagram (@pau.ferrandis).' },
    { id: 'm-cv8', _needs: IG_VISIT, titulo: 'Visita con Laura Ibáñez', tipo: 'visita', cuando: rel(2, '17:00'), contacto: 'm-ki12', agente: 'm-pe-2', resultado: 'pendiente', notas: 'Agendada por el asistente de Instagram (@lauraibz_).' },
    { id: 'm-cv9', _needs: IG_VISIT, titulo: 'Llamada con Raúl Navarro', tipo: 'llamada', cuando: rel(3, '09:00'), contacto: 'm-ki13', agente: 'm-pe-1', resultado: 'pendiente', notas: 'Agendada por el asistente de Instagram (@inversiones.navarro).' },
  ],
  reserva: [
    { id: 'm-rs1', huesped: 'Emma Schneider', alojamiento: 'm-in5', canal: 'airbnb', entrada: rel(-3), salida: rel(0), estado: 'en_casa', huespedes: 3, importe: 472, comision: 71, gastos: 45, pago: 'cobrado', localizador: 'HMQ4ZK2', llegada: '16:00', origen_sync: 'ical' },
    { id: 'm-rs2', huesped: 'Paolo Ricci', alojamiento: 'm-in5', canal: 'booking', entrada: rel(0), salida: rel(4), estado: 'confirmada', huespedes: 2, importe: 520, comision: 78, gastos: 45, pago: 'pendiente', localizador: '4021887733', llegada: '19:30', telefono: '+39 333 120 4410', origen_sync: 'ical' },
    { id: 'm-rs3', huesped: 'Familia Dubois', alojamiento: 'm-in5', canal: 'directa', entrada: rel(6), salida: rel(13), estado: 'confirmada', huespedes: 4, importe: 910, comision: 0, gastos: 45, pago: 'parcial', email: 'dubois@correo.fr' },
    { id: 'm-rs4', huesped: 'Liam O\'Connor', alojamiento: 'm-in6', canal: 'airbnb', entrada: rel(-1), salida: rel(2), estado: 'en_casa', huespedes: 2, importe: 315, comision: 47, gastos: 35, pago: 'cobrado', origen_sync: 'ical' },
    { id: 'm-rs5', huesped: 'Ana Pérez', alojamiento: 'm-in6', canal: 'booking', entrada: rel(2), salida: rel(5), estado: 'confirmada', huespedes: 2, importe: 300, comision: 45, gastos: 35, pago: 'pendiente', origen_sync: 'ical' },
    { id: 'm-rs6', huesped: 'Sven Larsen', alojamiento: 'm-in6', canal: 'airbnb', entrada: rel(4), salida: rel(8), estado: 'confirmada', huespedes: 2, importe: 420, comision: 63, gastos: 35, pago: 'pendiente', origen_sync: 'ical', notas: 'Se solapa con la reserva de Booking: revisar.' },
    { id: 'm-rs7', huesped: 'Grupo Martínez', alojamiento: 'm-in7', canal: 'booking', entrada: rel(1), salida: rel(4), estado: 'confirmada', huespedes: 6, importe: 610, comision: 92, gastos: 60, pago: 'pendiente', llegada: '15:00', origen_sync: 'ical' },
    { id: 'm-rs8', huesped: 'Bloqueo propietario', alojamiento: 'm-in7', canal: 'otro', entrada: rel(9), salida: rel(12), estado: 'bloqueo' },
    { id: 'm-rs9', huesped: 'Charlotte Evans', alojamiento: 'm-in7', canal: 'airbnb', entrada: rel(-8), salida: rel(-4), estado: 'finalizada', huespedes: 4, importe: 780, comision: 117, gastos: 60, pago: 'cobrado', origen_sync: 'ical' },
    { id: 'm-rs10', huesped: 'Familia Ortega', alojamiento: 'm-in8', canal: 'directa', entrada: rel(-2), salida: rel(5), estado: 'en_casa', huespedes: 7, importe: 1750, comision: 0, gastos: 80, pago: 'cobrado' },
    { id: 'm-rs11', huesped: 'Noah Weber', alojamiento: 'm-in8', canal: 'airbnb', entrada: rel(7), salida: rel(14), estado: 'confirmada', huespedes: 6, importe: 1820, comision: 273, gastos: 80, pago: 'pendiente', origen_sync: 'ical' },
    { id: 'm-rs12', huesped: 'Marta Gil', alojamiento: 'm-in6', canal: 'booking', entrada: rel(-10), salida: rel(-7), estado: 'cancelada', huespedes: 2, importe: 0, origen_sync: 'ical' },
    { id: 'm-rs13', _needs: IG_STAY, huesped: 'Sophie Martin', alojamiento: 'm-in5', canal: 'directa', entrada: rel(20), salida: rel(23), estado: 'pendiente', huespedes: 2, importe: 399, comision: 0, pago: 'pendiente', email: 'sophie.martin@correo.fr', notas: 'Pedida por Instagram (@sophie.travels). Pendiente de confirmar: confírmala y envía tú la forma de pago; el asistente no cobra nada.' },
    { id: 'm-rs14', _needs: IG_STAY, huesped: 'Jonas Keller', alojamiento: 'm-in7', canal: 'directa', entrada: rel(27), salida: rel(31), estado: 'confirmada', huespedes: 4, importe: 720, comision: 0, gastos: 60, pago: 'pendiente', email: 'jonas.keller@mail.de', notas: 'Pedida por Instagram (@jonas.k). Confirmada por Sara esta mañana.' },
  ],
  conversacion: [
    {
      id: 'm-ig1', _needs: IG_VISIT, usuario: '@martagarcia.vlc', nombre: 'Marta García', estado: 'agendado', puntuacion: 90, interes: 'comprar', presupuesto: 260000, zona: 'Ruzafa', plazo: 'ya', disparador: 'comentario', palabra_clave: 'PISO', canal: 'instagram', contacto: 'm-ki10', inicio: night('22:04'), ultima_actividad: night('22:09'), enlace: 'https://ig.me/m/martagarcia.vlc',
      resumen: 'Comprar · 260.000 € · Ruzafa · Cuanto antes · 90/100 · Visita mañana a las 10:00',
      transcripcion: chat('@martagarcia.vlc', [['22:04', 0, '(comentario) PISO'], ['22:04', 1, `${HELLO} ¿Qué estás buscando?`], ['22:05', 0, 'Comprar'], ['22:05', 1, '¿En qué zona te gustaría?'], ['22:06', 0, 'Ruzafa o cerca'], ['22:06', 1, '¿Qué presupuesto manejas, más o menos?'], ['22:07', 0, 'Unos 260.000'], ['22:07', 1, '¿Para cuándo lo necesitas?'], ['22:07', 0, 'Cuanto antes'], ['22:08', 0, '611 220 931'], ['22:08', 1, '¿Cuándo te viene bien que te enseñemos lo que tenemos?'], ['22:09', 0, 'Mañana a las 10'], ['22:09', 1, '¡Hecho! Te apunto: visita mañana a las 10:00.']]),
    },
    {
      id: 'm-ig2', _needs: IG_VISIT, usuario: '@pau.ferrandis', nombre: 'Pau Ferrandis', estado: 'agendado', puntuacion: 95, interes: 'vender', presupuesto: 320000, zona: 'Benimaclet', plazo: 'ya', disparador: 'historia', canal: 'instagram', contacto: 'm-ki11', inicio: night('22:31'), ultima_actividad: night('22:38'), enlace: 'https://ig.me/m/pau.ferrandis',
      resumen: 'Vender · 320.000 € · Benimaclet · Cuanto antes · 95/100 · Tasación mañana a las 12:00',
      transcripcion: chat('@pau.ferrandis', [['22:31', 0, '(respuesta a historia) ¿Cuánto vale mi piso? 🙋‍♂️'], ['22:31', 1, `${HELLO} ¿Qué estás buscando?`], ['22:32', 0, 'Vender mi casa'], ['22:33', 0, 'Benimaclet, 3 habitaciones'], ['22:34', 0, '320.000 más o menos'], ['22:35', 0, 'Cuanto antes, nos mudamos'], ['22:36', 0, '644 018 772'], ['22:37', 1, '¿Cuándo pasamos a verla? La valoración es gratis.'], ['22:38', 0, 'Mañana a las 12'], ['22:38', 1, '¡Hecho! Te apunto: tasación mañana a las 12:00.']]),
    },
    {
      id: 'm-ig3', _needs: IG_VISIT, usuario: '@lauraibz_', nombre: 'Laura Ibáñez', estado: 'agendado', puntuacion: 75, interes: 'comprar', presupuesto: 180000, zona: 'Campanar', plazo: 'tres_meses', disparador: 'comentario', palabra_clave: 'INFO', canal: 'instagram', contacto: 'm-ki12', inicio: night('23:12'), ultima_actividad: night('23:20'), enlace: 'https://ig.me/m/lauraibz_',
      resumen: 'Comprar · 180.000 € · Campanar · En 3–6 meses · 75/100 · Visita pasado mañana a las 17:00',
      transcripcion: chat('@lauraibz_', [['23:12', 0, '(comentario) INFO 😍'], ['23:12', 1, `${HELLO} ¿Qué estás buscando?`], ['23:14', 0, 'Comprar'], ['23:15', 0, 'Campanar'], ['23:16', 0, 'Hasta 180 mil'], ['23:17', 0, 'En unos meses'], ['23:18', 0, '622 901 455'], ['23:19', 1, '¿Cuándo te viene bien que te enseñemos lo que tenemos?'], ['23:20', 0, 'Pasado mañana por la tarde'], ['23:20', 1, '¡Hecho! Te apunto: visita pasado mañana a las 17:00.']]),
    },
    {
      id: 'm-ig4', _needs: IG_VISIT, usuario: '@inversiones.navarro', nombre: 'Raúl Navarro', estado: 'agendado', puntuacion: 100, interes: 'invertir', presupuesto: 450000, zona: 'El Carmen', plazo: 'ya', disparador: 'dm', canal: 'instagram', contacto: 'm-ki13', inicio: night('23:47'), ultima_actividad: night('23:55'), enlace: 'https://ig.me/m/inversiones.navarro',
      resumen: 'Invertir · 450.000 € · El Carmen · Cuanto antes · 100/100 · Llamada en 3 días a las 09:00',
      transcripcion: chat('@inversiones.navarro', [['23:47', 0, 'Buenas, busco 2 pisos para alquiler turístico en el centro'], ['23:47', 1, `${HELLO} ¿Qué estás buscando?`], ['23:48', 0, 'Invertir'], ['23:49', 0, 'El Carmen o Ruzafa'], ['23:50', 0, 'Más de 300.000 €'], ['23:51', 0, 'Cuanto antes'], ['23:52', 0, '655 300 118'], ['23:54', 1, '¿Cuándo te viene bien que te enseñemos lo que tenemos?'], ['23:55', 0, 'Que me llaméis a primera hora'], ['23:55', 1, '¡Hecho! Te apunto una llamada a las 09:00.']]),
    },
    {
      id: 'm-ig5', _needs: IG_STAY, usuario: '@sophie.travels', nombre: 'Sophie Martin', estado: 'reservado', puntuacion: 80, interes: 'reservar', fechas: `${dm(rel(20))} → ${dm(rel(23))} (3 noches)`, huespedes: 2, disparador: 'comentario', palabra_clave: 'RESERVA', canal: 'instagram', contacto: 'm-ki14', inmueble: 'm-in5', inicio: night('00:18'), ultima_actividad: night('00:26'), enlace: 'https://ig.me/m/sophie.travels',
      resumen: 'Reservar · 3 noches · 2 personas · 80/100 · Prerreserva Apartamento Malvarrosa Sol',
      transcripcion: chat('@sophie.travels', [['00:18', 0, '(comentario) RESERVA ❤️'], ['00:18', 1, `${STAY} ¿A nombre de quién hago la reserva?`], ['00:19', 0, 'Sophie Martin'], ['00:20', 0, 'sophie.martin@correo.fr'], ['00:20', 1, '¿Qué día llegaríais? Escríbelo así: 14/11.'], ['00:22', 0, 'Llegamos un viernes, 3 noches, somos 2'], ['00:24', 1, 'Tengo libre: • Apartamento Malvarrosa Sol: 3 noches, unos 399 € ¿Cuál te guardo?'], ['00:26', 0, 'Apartamento Malvarrosa Sol'], ['00:26', 1, '¡Te la guardo! Es una prerreserva: un compañero te la confirma y te dice cómo pagar. Por aquí no se cobra nada.']]),
    },
    {
      id: 'm-ig6', _needs: IG_STAY, usuario: '@jonas.k', nombre: 'Jonas Keller', estado: 'reservado', puntuacion: 80, interes: 'reservar', fechas: `${dm(rel(27))} → ${dm(rel(31))} (4 noches)`, huespedes: 4, disparador: 'historia', canal: 'instagram', contacto: 'm-ki15', inmueble: 'm-in7', inicio: night('00:41'), ultima_actividad: night('00:50'), enlace: 'https://ig.me/m/jonas.k',
      resumen: 'Reservar · 4 noches · 4 personas · 80/100 · Ático Ruzafa Terraza (confirmada por Sara esta mañana)',
      transcripcion: chat('@jonas.k', [['00:41', 0, '(respuesta a historia) Is the terrace flat free next month? We are 4'], ['00:41', 1, `${STAY} ¿A nombre de quién hago la reserva?`], ['00:43', 0, 'Jonas Keller'], ['00:44', 0, 'jonas.keller@mail.de'], ['00:47', 0, '4 noches, 4 personas'], ['00:48', 1, 'Tengo libre: • Ático Ruzafa Terraza: 4 noches, unos 720 € ¿Cuál te guardo?'], ['00:50', 0, 'Ático Ruzafa Terraza'], ['00:50', 1, '¡Te la guardo! Es una prerreserva: un compañero te la confirma y te dice cómo pagar.']]),
    },
    {
      id: 'm-ig7', _needs: IG, usuario: '@carlos.mp', nombre: 'Carlos Molina', estado: 'cualificado', puntuacion: 60, interes: 'alquilar', presupuesto: 900, zona: 'Benimaclet', plazo: 'ya', disparador: 'dm', canal: 'instagram', contacto: 'm-ki16', inicio: night('01:02'), ultima_actividad: night('01:07'), enlace: 'https://ig.me/m/carlos.mp',
      resumen: 'Alquilar · 900 € · Benimaclet · Cuanto antes · 60/100 · Le ofrecí 3 huecos y no ha elegido',
      transcripcion: chat('@carlos.mp', [['01:02', 0, 'Hola! Tenéis pisos de alquiler por Benimaclet?'], ['01:02', 1, `${HELLO} ¿Qué estás buscando?`], ['01:03', 0, 'Alquilar'], ['01:04', 0, 'Benimaclet'], ['01:05', 0, '900 al mes'], ['01:06', 0, 'Ya'], ['01:06', 0, 'no'], ['01:07', 1, '¿Cuándo te viene bien que te enseñemos lo que tenemos?']]),
    },
    {
      id: 'm-ig8', _needs: IG, usuario: '@ana_belen.r', nombre: 'Ana Belén Ruiz', estado: 'en_curso', puntuacion: 0, interes: 'comprar', presupuesto: 150000, disparador: 'comentario', palabra_clave: 'PISO', canal: 'instagram', contacto: 'm-ki17', inicio: night('01:15'), ultima_actividad: night('01:19'), enlace: 'https://ig.me/m/ana_belen.r',
      resumen: 'Comprar · 150.000 € · a medias: falta el plazo',
      transcripcion: chat('@ana_belen.r', [['01:15', 0, '(comentario) PISO'], ['01:15', 1, `${HELLO} ¿Qué estás buscando?`], ['01:16', 0, 'Comprar'], ['01:17', 0, 'Patraix'], ['01:18', 0, '150.000'], ['01:19', 1, '¿Para cuándo lo necesitas?']]),
    },
    {
      id: 'm-ig9', _needs: IG, usuario: '@nuria.sanchis', nombre: 'Nuria Sanchis', estado: 'en_curso', interes: 'comprar', disparador: 'comentario', palabra_clave: 'INFO', canal: 'instagram', contacto: 'm-ki18', inicio: night('01:33'), ultima_actividad: night('01:34'), enlace: 'https://ig.me/m/nuria.sanchis',
      resumen: 'Comprar · a medias: falta la zona',
      transcripcion: chat('@nuria.sanchis', [['01:33', 0, '(comentario) INFO'], ['01:33', 1, `${HELLO} ¿Qué estás buscando?`], ['01:34', 0, 'Comprar'], ['01:34', 1, '¿En qué zona te gustaría?']]),
    },
    {
      id: 'm-ig10', _needs: IG, usuario: '@dlopez_', nombre: 'David López', estado: 'humano', interes: 'alquilar', disparador: 'anuncio', canal: 'instagram', contacto: 'm-ki19', inicio: night('01:40'), ultima_actividad: night('01:42'), enlace: 'https://ig.me/m/dlopez_',
      resumen: 'Alquilar · pregunta si se admiten mascotas: quiere hablar con una persona',
      transcripcion: chat('@dlopez_', [['01:40', 0, 'Vengo del anuncio. ¿Aceptáis perros?'], ['01:40', 1, `${HELLO} ¿Qué estás buscando?`], ['01:41', 0, 'Alquilar'], ['01:42', 0, 'Prefiero hablar con una persona'], ['01:42', 1, 'Te paso con una persona del equipo. Te escribimos por aquí en cuanto podamos.']]),
    },
    {
      id: 'm-ig11', _needs: IG, usuario: '@eli.martorell', nombre: 'Elisa Martorell', estado: 'descartado', puntuacion: 0, interes: 'comprar', plazo: 'mirando', disparador: 'historia', canal: 'instagram', contacto: 'm-ki20', inicio: night('01:48'), ultima_actividad: night('01:51'), enlace: 'https://ig.me/m/eli.martorell',
      resumen: 'Comprar · Solo mirando · no le interesa por ahora',
      transcripcion: chat('@eli.martorell', [['01:48', 0, '(respuesta a historia) 😍😍'], ['01:48', 1, `${HELLO} ¿Qué estás buscando?`], ['01:49', 0, 'Comprar'], ['01:50', 0, 'Solo estoy mirando'], ['01:51', 0, 'No me interesa, gracias'], ['01:51', 1, 'Entendido, no te escribimos más. Si cambias de idea, aquí estamos. ¡Gracias!']]),
    },
    {
      id: 'm-ig12', _needs: IG, usuario: '@joan.peris', nombre: 'Joan Peris', estado: 'descartado', puntuacion: 5, interes: 'informacion', disparador: 'comentario', palabra_clave: 'INFO', canal: 'instagram', contacto: 'm-ki21', inicio: night('01:52'), ultima_actividad: night('01:53'), enlace: 'https://ig.me/m/joan.peris',
      resumen: 'Información · solo quería saber el precio del reel',
      transcripcion: chat('@joan.peris', [['01:52', 0, '(comentario) INFO precio?'], ['01:52', 1, `${HELLO} ¿Qué estás buscando?`], ['01:53', 0, 'Nada, solo era curiosidad. No me interesa'], ['01:53', 1, 'Entendido, no te escribimos más. Si cambias de idea, aquí estamos. ¡Gracias!']]),
    },
  ],
  servicio: [
    { id: 'm-sv1', titulo: 'Limpieza salida Emma · T-01', tipo: 'limpieza', alojamiento: 'm-in5', reserva: 'm-rs1', fecha: rel(0, '11:00'), responsable: 'm-pe-4', estado: 'asignada', coste: 45, checklist: 'Sábanas y toallas\nCocina\nBaños\nReponer café y papel\nFoto final' },
    { id: 'm-sv2', titulo: 'Check-in Paolo · T-01', tipo: 'check_in', alojamiento: 'm-in5', reserva: 'm-rs2', fecha: rel(0, '19:30'), responsable: 'm-pe-4', estado: 'pendiente' },
    { id: 'm-sv3', titulo: 'Limpieza antes del grupo · T-03', tipo: 'limpieza', alojamiento: 'm-in7', reserva: 'm-rs7', fecha: rel(1, '10:00'), estado: 'pendiente', coste: 60 },
    { id: 'm-sv4', titulo: 'Limpieza salida Liam · T-02', tipo: 'limpieza', alojamiento: 'm-in6', reserva: 'm-rs4', fecha: rel(2, '11:00'), responsable: 'm-pe-4', estado: 'asignada', coste: 35 },
    { id: 'm-sv5', titulo: 'Revisar aire acondicionado · T-04', tipo: 'mantenimiento', alojamiento: 'm-in8', fecha: rel(-1, '09:00'), responsable: 'm-pe-3', estado: 'problema', coste: 90, notas: 'El técnico no viene hasta el jueves.' },
    { id: 'm-sv6', titulo: 'Limpieza salida Charlotte · T-03', tipo: 'limpieza', alojamiento: 'm-in7', reserva: 'm-rs9', fecha: rel(-4, '11:00'), responsable: 'm-pe-4', estado: 'hecha', coste: 60 },
  ],
  incidencia: [
    { id: 'm-ic1', asunto: 'Aire acondicionado no enfría', alojamiento: 'm-in8', prioridad: 'alta', estado: 'en_curso', responsable: 'm-pe-3', abierta: rel(-1), coste: 90 },
    { id: 'm-ic2', asunto: 'Falta un juego de llaves', alojamiento: 'm-in6', prioridad: 'media', estado: 'abierta', abierta: rel(0) },
    { id: 'm-ic3', asunto: 'Grifo de la ducha gotea', alojamiento: 'm-in5', prioridad: 'baja', estado: 'resuelta', responsable: 'm-pe-3', abierta: rel(-12), coste: 25 },
  ],
  gasto: [
    { id: 'm-g1', concepto: 'Alquiler del local', fecha: rel(-9), categoria: 'alquiler', importe: 950, deducible: true },
    { id: 'm-g2', concepto: 'Luz y agua', fecha: rel(-7), categoria: 'suministros', importe: 184.3, deducible: true },
    { id: 'm-g3', concepto: 'Anuncios en redes', fecha: rel(-3), categoria: 'marketing', importe: 250, deducible: true },
    { id: 'm-g4', concepto: 'Comida con cliente', fecha: rel(-1), categoria: 'otros', importe: 62, deducible: false },
  ],
};

// Every sample property has a photo of its own under public/demo.
for (const r of SAMPLES.inmueble ?? []) r.foto ??= `/demo/inmuebles/${r.id}.jpg`;

// A year behind the demo agency: finished stays in the tourist flats (busier
// and dearer in summer) and the sales and rentals it closed, so the charts
// and the past cases have something real to show. Same numbers every time.
function history(): { reservas: Record<string, unknown>[]; operaciones: Record<string, unknown>[] } {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const GUESTS = ['Lucas Moreau', 'Julia Becker', 'Tom Harris', 'Giulia Conti', 'Familia Navarro', 'Anna Kowalska', 'Pierre Laurent', 'Sara Lindqvist', 'Familia Romero', 'Oliver Smith', 'Marie Dupont', 'Jan de Vries', 'Laura Pons', 'Hannah Müller', 'Diego Santos', 'Emily Clark'];
  const FLATS: [string, number, number][] = [['m-in5', 118, 45], ['m-in6', 95, 35], ['m-in7', 160, 60], ['m-in8', 240, 80]];
  const reservas: Record<string, unknown>[] = [];
  for (const [flat, night, clean] of FLATS) {
    for (let back = 330; back > 14; back -= 1) {
      if (rnd() > 0.08) continue;
      const nights = 2 + Math.floor(rnd() * 6);
      const d = new Date(); d.setDate(d.getDate() - back);
      const summer = [5, 6, 7].includes(d.getMonth()) ? 1.45 : [3, 4, 8].includes(d.getMonth()) ? 1.15 : 0.85;
      const canal = rnd() < 0.5 ? 'airbnb' : rnd() < 0.75 ? 'booking' : 'directa';
      const importe = Math.round(night * summer * nights + clean);
      reservas.push({
        id: `m-rh${reservas.length + 1}`, huesped: GUESTS[Math.floor(rnd() * GUESTS.length)], alojamiento: flat, canal,
        entrada: rel(-back), salida: rel(-back + nights), estado: 'finalizada', huespedes: 2 + Math.floor(rnd() * 3),
        importe, comision: canal === 'directa' ? 0 : Math.round(importe * 0.15), gastos: clean, pago: 'cobrado',
        ...(canal === 'directa' ? {} : { origen_sync: 'ical' }),
      });
      back -= nights + Math.floor(rnd() * 4);
    }
  }
  const operaciones: Record<string, unknown>[] = [
    ['Venta piso Benimaclet', 'compradores', 198000, 3, -300], ['Alquiler ático Ensanche', 'alquileres', 1350, 100, -270],
    ['Venta casa Rocafort', 'compradores', 385000, 3, -240], ['Venta piso Campanar', 'compradores', 172000, 3, -190],
    ['Alquiler piso Russafa', 'alquileres', 1100, 100, -150], ['Venta dúplex Patacona', 'compradores', 289000, 3, -110],
    ['Venta piso Cabanyal', 'compradores', 154000, 3, -75], ['Alquiler estudio Centro', 'alquileres', 850, 100, -55],
  ].map(([titulo, embudo, importe, comision, cierre], i) => ({ id: `m-oh${i + 1}`, titulo, embudo, etapa: 'cerrada', importe, comision, probabilidad: 100, agente: i % 2 ? 'm-pe-1' : 'm-pe-2', cierre: rel(cierre as number) }));
  return { reservas, operaciones };
}
const past = history();
SAMPLES.reserva.push(...past.reservas);
SAMPLES.operacion.push(...past.operaciones);

// Sample records for the entities a blueprint has, dropping links to entities it doesn't.
export function sampleRecordsFor(bp: Blueprint): AppRecord[] {
  const out: AppRecord[] = [];
  const sector = getSector(bp.sector);
  const bookings = bp.entities.some((e) => e.key === 'reserva');
  for (const e of bp.entities) {
    for (const { id, ...base } of SAMPLES[e.key] ?? []) {
      // Tourist flats only come with an app that takes bookings.
      if (e.key === 'inmueble' && base.operacion === 'turistico' && !bookings) continue;
      // Rows that only make sense with other sections (a lead the assistant booked a visit for).
      if (Array.isArray(base._needs) && !base._needs.every((k) => bp.entities.some((x) => x.key === k))) continue;
      const data = { ...base, ...sector?.samples?.[String(id)] };
      const clean: Record<string, unknown> = {};
      for (const f of e.fields) {
        const v = data[f.key];
        if (v === undefined) continue;
        if (f.type === 'relation' && !bp.entities.some((x) => x.key === f.relation)) continue;
        clean[f.key] = v;
      }
      out.push({ id: String(id), entity: e.key, data: clean, is_sample: true });
    }
  }
  return out;
}

// ---- Proposals made by picking cards (no AI involved) ----

// "Añadir Facturas y Pedidos · Quitar Inventario", from the module lists.
export function modulesSummary(before: Blueprint | null, after: Blueprint): string {
  const was = new Set(before?.modules ?? []);
  const now = new Set(after.modules ?? []);
  const names = (keys: string[]) => keys.map((k) => getModule(k)?.name ?? k).join(', ');
  const added = [...now].filter((k) => !was.has(k));
  const removed = [...was].filter((k) => !now.has(k));
  const parts = [added.length ? `Añadir ${names(added)}` : '', removed.length ? `Quitar ${names(removed)}` : ''].filter(Boolean);
  return (parts.join(' · ') || 'Cambiar funciones').slice(0, 200);
}

// Validated like any other proposal. Sample rows come only for entities the
// change brings in, with fresh ids (newId) and their links rewritten to match.
export function cardProposal(current: Blueprint | null, next: Blueprint, newId: () => string): { proposal: Proposal } | { errors: string[] } {
  const errors = validateBlueprint(next);
  if (errors.length) return { errors };
  const had = new Set(current?.entities.map((e) => e.key) ?? []);
  const rows = sampleRecordsFor(next).filter((r) => !had.has(r.entity));
  const ids = new Map(rows.map((r) => [r.id, newId()]));
  const samples: SampleRecord[] = rows.map((r) => {
    const e = next.entities.find((x) => x.key === r.entity)!;
    const data = { ...r.data };
    for (const f of e.fields) {
      if (f.type !== 'relation' || data[f.key] == null) continue;
      const to = ids.get(String(data[f.key]));
      if (to) data[f.key] = to; else delete data[f.key];
    }
    return { id: ids.get(r.id)!, entity: r.entity, data };
  });
  return { proposal: { summary: modulesSummary(current, next), blueprint: next, changes: diffBlueprints(current, next), samples } };
}
