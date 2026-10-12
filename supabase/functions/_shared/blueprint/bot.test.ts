import { describe, expect, it } from 'vitest';
import { addModule, composeApp, composePack, removeModule, sampleRecordsFor } from './modules.ts';
import { validateBlueprint } from './validate.ts';
import { diffBlueprints } from './diff.ts';
import { runAgent } from './agent.ts';
import type { CallModel } from './agent.ts';
import { applyBotOps, botTemplate, hasKeyword, parseAmount, parseDate, runBot, scoreOf, slotLabel } from './bot.ts';
import type { BotEvent, BotState, BotTurn } from './bot.ts';
import type { AppRecord, Blueprint } from './types.ts';

// Monday 12 October 2026, 23:00: the assistant works at night.
const NOW = new Date('2026-10-12T23:00:00');
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// A tiny in-memory app: runs the assistant and applies what it returns.
function app(bp: Blueprint, records: AppRecord[] = []) {
  const rs = clone(records);
  let n = 0;
  const say = async (ev: Partial<BotEvent> & { text: string }, now = NOW): Promise<BotTurn> => {
    const turn = runBot(bp, rs, { kind: 'dm', username: 'lead.prueba', igId: 'ig-1', ...ev }, { now, newId: () => `tmp-${++n}` });
    await applyBotOps(turn.ops, {
      create: async (entity, data) => { const id = `r-${++n}`; rs.push({ id, entity, data: clone(data) }); return id; },
      update: async (id, patch) => { const r = rs.find((x) => x.id === id)!; r.data = { ...r.data, ...clone(patch) }; },
    });
    return turn;
  };
  const of = (entity: string) => rs.filter((r) => r.entity === entity);
  const conv = () => of('conversacion').find((r) => r.data.ig_id === 'ig-1')!;
  const contact = () => rs.find((r) => r.id === conv().data.contacto)!;
  return { rs, say, of, conv, contact };
}
const last = (t: BotTurn) => t.replies[t.replies.length - 1];

describe('Asistente de Instagram: plantillas y piezas', () => {
  it('each pack brings the assistant that fits it, valid and switched on', () => {
    const sales = composePack('compraventa', 'Agencia');
    expect(sales.bot).toMatchObject({ enabled: true, template: 'compradores', auto: true, finish: { mode: 'agenda', citaTipo: 'visita' } });
    const tour = composePack('turistico', 'Pisos');
    expect(tour.bot).toMatchObject({ enabled: true, template: 'reservas', finish: { mode: 'reserva' } });
    const both = composePack('ambos', 'Agencia');
    expect(both.bot?.finish.mode).toBe('agenda');
    for (const bp of [sales, tour, both]) {
      expect(validateBlueprint(bp)).toEqual([]);
      expect(bp.modules?.indexOf('instagram')).toBe((bp.modules?.indexOf('contactos_inmo') ?? -9) + 1);
      expect(bp.views.find((v) => v.key === 'instagram')?.label).toBe('Bandeja de Instagram');
    }
    // Alone, without an agenda, it hands over to a person; adding the agenda later upgrades an untouched template.
    let alone = composeApp('crm', 'X', ['instagram']);
    expect(alone.bot?.finish.mode).toBe('humano');
    expect(validateBlueprint(alone)).toEqual([]);
    alone = addModule(addModule(alone, 'contactos_inmo'), 'agenda_inmo');
    expect(alone.bot?.finish.mode).toBe('agenda');
    expect(validateBlueprint(alone)).toEqual([]);
  });

  it('removing the piece switches it off and keeps it; putting it back brings it back as it was', () => {
    let bp = composePack('compraventa', 'Agencia');
    bp.bot = { ...bp.bot!, auto: false, keywords: ['CASA'] };
    bp = removeModule(bp, 'instagram');
    expect(bp.entities.some((e) => e.key === 'conversacion')).toBe(false);
    expect(bp.bot).toMatchObject({ enabled: false, keywords: ['CASA'] });
    expect(validateBlueprint(bp)).toEqual([]);
    bp = addModule(bp, 'instagram');
    expect(bp.bot).toMatchObject({ enabled: true, keywords: ['CASA'] });
    expect(validateBlueprint(bp)).toEqual([]);
    // An edited assistant that books visits can't lose the agenda silently.
    expect(validateBlueprint(removeModule(bp, 'agenda_inmo')).join()).toMatch(/para dar cita hace falta la Agenda/);
  });

  it('every template is valid in the pack it is meant for', () => {
    const sales = composePack('compraventa', 'A');
    for (const t of ['compradores', 'vendedores'] as const) expect(validateBlueprint({ ...sales, bot: botTemplate(sales, t) }), t).toEqual([]);
    const tour = composePack('turistico', 'A');
    expect(validateBlueprint({ ...tour, bot: botTemplate(tour, 'reservas') })).toEqual([]);
  });

  it('sample data: last night’s conversations, with their visits and bookings, only where they fit', () => {
    const rows = (pack: 'compraventa' | 'turistico' | 'ambos') => sampleRecordsFor(composePack(pack, 'A'));
    const both = rows('ambos');
    const convs = both.filter((r) => r.entity === 'conversacion');
    expect(convs).toHaveLength(12);
    const by = (s: string) => convs.filter((r) => r.data.estado === s).length;
    expect([by('agendado'), by('reservado')]).toEqual([4, 2]);
    expect(convs.every((r) => typeof r.data.transcripcion === 'string' && String(r.data.transcripcion).includes('Asistente:'))).toBe(true);
    expect(both.filter((r) => r.entity === 'reserva' && String(r.data.notas ?? '').includes('Instagram')).map((r) => r.data.estado).sort()).toEqual(['confirmada', 'pendiente']);
    expect(both.filter((r) => r.entity === 'cita_inmo' && String(r.data.notas ?? '').includes('Instagram'))).toHaveLength(4);
    // No bookings without the tourist piece, no visits without the agenda.
    expect(rows('compraventa').filter((r) => r.entity === 'conversacion' && r.data.estado === 'reservado')).toEqual([]);
    expect(rows('turistico').filter((r) => r.entity === 'conversacion' && r.data.estado === 'agendado')).toEqual([]);
    expect(rows('turistico').some((r) => r.entity === 'contacto_inmo' && r.data.nombre === 'Pau')).toBe(false);
  });
});

describe('Asistente de Instagram: entender respuestas', () => {
  it('reads amounts the way people write them', () => {
    expect(parseAmount('250.000 €')).toBe(250000);
    expect(parseAmount('unos 250k')).toBe(250000);
    expect(parseAmount('250 mil')).toBe(250000);
    expect(parseAmount('1,5 millones')).toBe(1500000);
    expect(parseAmount('1.200,50')).toBe(1200.5);
    expect(parseAmount('900 al mes')).toBe(900);
    expect(parseAmount('tres')).toBe(3);
    expect(parseAmount('6+')).toBe(6);
    expect(parseAmount('no sé')).toBeNull();
  });

  it('reads dates and never returns one in the past', () => {
    expect(parseDate('14/11', NOW)).toBe('2026-11-14');
    expect(parseDate('el 14-11-2026', NOW)).toBe('2026-11-14');
    expect(parseDate('14 de noviembre', NOW)).toBe('2026-11-14');
    expect(parseDate('3 ene', NOW)).toBe('2027-01-03');
    expect(parseDate('1/10', NOW)).toBe('2027-10-01');
    expect(parseDate('mañana', NOW)).toBe('2026-10-13');
    expect(parseDate('pasado mañana', NOW)).toBe('2026-10-14');
    expect(parseDate('31/02', NOW)).toBeNull();
    expect(parseDate('1/1/2020', NOW)).toBeNull();
    expect(parseDate('cuando sea', NOW)).toBeNull();
  });

  it('keywords: whole words, any case, with or without accents', () => {
    expect(hasKeyword('¡Piso! 😍', ['INFO', 'PISO'])).toBe('PISO');
    expect(hasKeyword('quiero info', ['INFO'])).toBe('INFO');
    expect(hasKeyword('tasacion por favor', ['TASACIÓN'])).toBe('TASACIÓN');
    expect(hasKeyword('información', ['INFO'])).toBeNull();
    expect(hasKeyword('pisotón', ['PISO'])).toBeNull();
  });

  it('scores with the rules and stays between 0 and 100', () => {
    const bot = botTemplate(composePack('compraventa', 'A'));
    expect(scoreOf(bot.rules, { presupuesto: 300000, plazo: 'ya', interes: 'invertir' }, { telefono: '600' })).toBe(100);
    expect(scoreOf(bot.rules, { plazo: 'mirando' }, {})).toBe(0);
    expect(scoreOf(bot.rules, { presupuesto: 140000, plazo: 'tres_meses', interes: 'comprar' }, {})).toBe(30);
  });
});

describe('Asistente de Instagram: conversaciones', () => {
  const sales = () => composePack('compraventa', 'Inmobiliaria Sol');

  it('a comment with a keyword opens one private reply, answers under the comment and creates the lead', async () => {
    const a = app(sales());
    const t = await a.say({ kind: 'comment', text: 'PISO 😍', username: 'marta.vlc', name: 'Marta García' });
    expect(t.handled).toBe(true);
    expect(t.replies).toHaveLength(1);
    expect(t.replies[0].text).toMatch(/Soy el asistente de Inmobiliaria Sol/);
    expect(t.replies[0].text).toMatch(/¿Qué estás buscando\?\n\nResponde: Comprar · Alquilar · Invertir · Vender mi casa$/);
    expect(t.publicReply).toBe('¡Te escribo por privado! 📩');
    expect(a.conv().data).toMatchObject({ usuario: '@marta.vlc', estado: 'en_curso', disparador: 'comentario', palabra_clave: 'PISO', canal: 'instagram', enlace: 'https://ig.me/m/marta.vlc', inicio: '2026-10-12T23:00' });
    expect(a.contact().data).toMatchObject({ nombre: 'Marta García', origen: 'instagram', temperatura: 'templado', alta: '2026-10-12' });
    expect((a.conv().data._bot as BotState).step).toBe(0);
    // Without a keyword nothing happens, and a second comment doesn't restart a chat in progress.
    expect(runBot(sales(), a.rs, { kind: 'comment', text: 'Qué bonito', username: 'otra' }, { now: NOW, newId: () => 'x' }).ops).toEqual([]);
    expect((await a.say({ kind: 'comment', text: 'INFO', username: 'marta.vlc' })).replies).toEqual([]);
  });

  it('qualifies a buyer and books a visit in a free slot of the agenda', async () => {
    const bp = sales();
    // Tuesday 10:00 is already taken by another visit.
    const a = app(bp, [{ id: 'c0', entity: 'cita_inmo', data: { titulo: 'Otra', cuando: '2026-10-13T09:00' } }]);
    let t = await a.say({ text: 'Hola! Info del piso de Ruzafa?' });
    expect(t.replies.map((r) => r.text)).toEqual([expect.stringMatching(/^¡Hola! 👋/), '¿Qué estás buscando?']);
    expect(last(t).quick).toEqual(['Comprar', 'Alquilar', 'Invertir', 'Vender mi casa']);
    t = await a.say({ text: 'quiero comprar' });
    expect(last(t).text).toBe('¿En qué zona te gustaría?');
    await a.say({ text: 'Ruzafa' });
    t = await a.say({ text: 'unos 250.000' });
    expect(last(t).quick).toContain('Cuanto antes');
    await a.say({ text: 'Cuanto antes' });
    t = await a.say({ text: '611 22 09 31' });
    expect(last(t).text).toMatch(/¿Cuándo te viene bien/);
    // One slot per working day, the taken one skipped, plus «another day» and «call me».
    expect(last(t).quick).toEqual(['mar 13 oct · 10:00', 'mié 14 oct · 09:00', 'jue 15 oct · 09:00', 'Otro día', 'Que me llaméis']);
    expect(a.conv().data).toMatchObject({ estado: 'cualificado', puntuacion: 90, interes: 'comprar', zona: 'Ruzafa', presupuesto: 250000, plazo: 'ya' });
    expect(a.contact().data).toMatchObject({ tipo: 'comprador', zonas: 'Ruzafa', presupuesto: 250000, telefono: '611 22 09 31', temperatura: 'caliente' });

    t = await a.say({ text: 'Otro día' });
    expect(last(t).quick?.slice(0, 3)).toEqual(['vie 16 oct · 09:00', 'lun 19 oct · 09:00', 'mar 20 oct · 09:00']);
    t = await a.say({ text: 'el viernes a las 9' });
    expect(last(t).text).toMatch(/^¡Hecho! Te apunto: visita el viernes 16 de octubre a las 09:00\./);
    const cita = a.of('cita_inmo').find((r) => r.id !== 'c0')!;
    expect(cita.data).toMatchObject({ titulo: 'Visita con @lead.prueba', tipo: 'visita', cuando: '2026-10-16T09:00', contacto: a.contact().id, resultado: 'pendiente' });
    expect(a.conv().data.estado).toBe('agendado');
    expect(a.conv().data.resumen).toBe('Comprar · 250.000 € · Ruzafa · Cuanto antes · 90/100 · Visita vie 16 oct · 09:00');
    expect(a.contact().data).toMatchObject({ seguimiento: '2026-10-16T09:00', proxima_accion: 'Visita el viernes 16 de octubre a las 09:00' });
    expect(String(a.conv().data.transcripcion).split('\n')).toContain('[23:00] @lead.prueba: quiero comprar');
    // Done: the next message is kept in the history, but a person answers it.
    t = await a.say({ text: 'Gracias!!' });
    expect(t.handled).toBe(false);
    expect(t.replies).toEqual([]);
    expect(String(a.conv().data.transcripcion)).toMatch(/Gracias!!$/);
  });

  it('a seller gets a valuation appointment', async () => {
    const bp = sales();
    bp.bot = botTemplate(bp, 'vendedores');
    const a = app(bp);
    await a.say({ text: 'VENDER' });
    for (const m of ['Venderla', 'Benimaclet', '320 mil', 'Cuanto antes', '644018772']) await a.say({ text: m });
    const t = await a.say({ text: '1' });
    expect(last(t).text).toMatch(/Te apunto: tasación el martes 13/);
    expect(a.of('cita_inmo')[0].data).toMatchObject({ tipo: 'tasacion', titulo: 'Tasación con @lead.prueba' });
    expect(a.contact().data.tipo).toBe('vendedor');
  });

  it('below the minimum it hands over to a person instead of booking', async () => {
    const a = app(sales());
    await a.say({ text: 'info' });
    // Two answers it can't read as a budget: it moves on without one.
    for (const m of ['Alquilar', 'Centro', 'no sé', 'ni idea', 'Solo estoy mirando']) await a.say({ text: m });
    const t = await a.say({ text: 'no' });
    expect(last(t).text).toMatch(/Le paso lo que me has contado al equipo/);
    expect(a.conv().data).toMatchObject({ estado: 'humano', puntuacion: 0 });
    expect(a.contact().data.temperatura).toBe('frio');
    expect(a.of('cita_inmo')).toEqual([]);
  });

  it('asks again once when it doesn’t understand, then moves on', async () => {
    const bp = sales();
    bp.bot!.questions = [{ key: 'email', text: '¿Tu email?', entity: 'contacto_inmo', field: 'email' }, ...bp.bot!.questions.slice(0, 1)];
    const a = app(bp);
    await a.say({ text: 'piso' });
    let t = await a.say({ text: 'no tengo de eso' });
    expect(last(t).text).toBe('Perdona, no parece un email. ¿Tu email?');
    t = await a.say({ text: 'tampoco' });
    expect(last(t).text).toBe('¿Qué estás buscando?');
    expect(a.contact().data.email).toBeUndefined();
    t = await a.say({ text: 'algo raro' });
    expect(last(t).text).toBe('Perdona, no te he entendido. ¿Qué estás buscando?');
    expect(last(t).quick).toHaveLength(4);
  });

  it('a person can be asked for at any moment, and «no me interesa» closes it politely', async () => {
    const a = app(sales());
    await a.say({ text: 'info' });
    let t = await a.say({ text: 'Prefiero hablar con una persona' });
    expect(last(t).text).toMatch(/Te paso con una persona del equipo/);
    expect(a.conv().data.estado).toBe('humano');
    expect(a.contact().data.proxima_accion).toBe('Llamar: lo ha pedido por Instagram');
    expect((await a.say({ text: 'hola?' })).replies).toEqual([]);

    const b = app(sales());
    await b.say({ text: 'info' });
    t = await b.say({ text: 'No me interesa' });
    expect(last(t).text).toMatch(/no te escribimos más/);
    expect(b.conv().data.estado).toBe('descartado');
    expect(b.contact().data.temperatura).toBe('descartado');
  });

  it('DMs without a keyword only start it when «any DM» is on; story replies and ads too', async () => {
    const bp = sales();
    bp.bot!.anyDm = false;
    expect(runBot(bp, [], { kind: 'dm', text: 'hola', username: 'x' }, { now: NOW, newId: () => 'i' }).handled).toBe(false);
    expect(runBot(bp, [], { kind: 'dm', text: 'quiero INFO', username: 'x' }, { now: NOW, newId: () => 'i' }).handled).toBe(true);
    expect(runBot(bp, [], { kind: 'ad', text: 'Vengo del anuncio', username: 'x' }, { now: NOW, newId: () => 'i' }).handled).toBe(true);
    const story = runBot(sales(), [], { kind: 'story', text: '😍 me encanta', username: 'x' }, { now: NOW, newId: () => `i${Math.random()}` });
    expect(story.ops.find((o) => o.entity === 'conversacion')?.data.disparador).toBe('historia');
    // Switched off, it never answers.
    bp.bot!.enabled = false;
    expect(runBot(bp, [], { kind: 'dm', text: 'INFO', username: 'x' }, { now: NOW, newId: () => 'i' }).handled).toBe(false);
  });

  it('a returning lead keeps the same contact', async () => {
    const a = app(sales());
    await a.say({ text: 'info' });
    await a.say({ text: 'No me interesa' });
    const first = a.contact().id;
    await a.say({ text: 'PISO otra vez' });
    const convs = a.of('conversacion');
    expect(convs).toHaveLength(2);
    expect(new Set(convs.map((c) => c.data.contacto))).toEqual(new Set([first]));
    expect(a.of('contacto_inmo')).toHaveLength(1);
  });
});

describe('Asistente de Instagram: reservas directas', () => {
  const tour = () => composePack('turistico', 'Pisos Mar');
  const flats: AppRecord[] = [
    { id: 'f1', entity: 'inmueble', data: { direccion: 'Loft Carmen · C/ Quart 40', operacion: 'turistico', capacidad: 2, precio_noche: 95, tarifa_limpieza: 35 } },
    { id: 'f2', entity: 'inmueble', data: { direccion: 'Ático Ruzafa · C/ Cádiz 77', operacion: 'turistico', capacidad: 6, precio_noche: 165, tarifa_limpieza: 60 } },
    { id: 'f3', entity: 'inmueble', data: { direccion: 'Casa Patacona', operacion: 'turistico', capacidad: 8, precio_noche: 240 } },
    { id: 'f4', entity: 'inmueble', data: { direccion: 'Piso en venta', operacion: 'venta', capacidad: 9 } },
    { id: 'b1', entity: 'reserva', data: { huesped: 'Ocupa', alojamiento: 'f3', entrada: '2026-11-13', salida: '2026-11-20', estado: 'confirmada' } },
    { id: 'b2', entity: 'reserva', data: { huesped: 'Cancelada', alojamiento: 'f2', entrada: '2026-11-14', salida: '2026-11-16', estado: 'cancelada' } },
  ];

  it('asks dates and guests, offers only what is free and fits, and leaves a booking to confirm (never charged)', async () => {
    const a = app(tour(), flats);
    let t = await a.say({ kind: 'comment', text: 'RESERVA', username: 'sophie.travels' });
    expect(t.replies[0].text).toMatch(/¿A nombre de quién hago la reserva\?$/);
    t = await a.say({ text: 'Sophie Martin', username: 'sophie.travels' });
    expect(last(t).text).toMatch(/email/);
    t = await a.say({ text: 'sophie@correo.fr', username: 'sophie.travels' });
    expect(last(t).text).toBe('¿Qué día llegaríais? Escríbelo así: 14/11.');
    t = await a.say({ text: 'el 30 de febrero', username: 'sophie.travels' });
    expect(last(t).text).toMatch(/no he entendido la fecha/);
    t = await a.say({ text: '14/11', username: 'sophie.travels' });
    expect(last(t).text).toBe('Llegada el sábado 14 de noviembre. ¿Cuántas noches?');
    await a.say({ text: '3', username: 'sophie.travels' });
    t = await a.say({ text: 'Somos 4', username: 'sophie.travels' });
    // The loft is too small, the house is taken; the cancelled booking doesn't block the attic.
    expect(last(t).text).toBe('Del 14/11 al 17/11 tengo libre:\n• Ático Ruzafa: 3 noches, unos 555 €\n¿Cuál te guardo?');
    expect(last(t).quick).toEqual(['Ático Ruzafa', 'Que me llaméis']);
    t = await a.say({ text: 'el ático', username: 'sophie.travels' });
    expect(last(t).text).toMatch(/^¡Te la guardo! Ático Ruzafa, del 14\/11 al 17\/11 \(3 noches, 4 personas\): unos 555 €\. Es una prerreserva.*Por aquí no se cobra nada\./);
    const res = a.of('reserva').find((r) => !['b1', 'b2'].includes(r.id))!;
    expect(res.data).toMatchObject({ huesped: 'Sophie Martin', alojamiento: 'f2', canal: 'directa', entrada: '2026-11-14', salida: '2026-11-17', estado: 'pendiente', huespedes: 4, importe: 555, pago: 'pendiente', email: 'sophie@correo.fr' });
    expect(a.conv().data).toMatchObject({ estado: 'reservado', inmueble: 'f2', huespedes: 4, interes: 'reservar', fechas: '14/11 → 17/11 (3 noches)' });
    expect(a.contact().data).toMatchObject({ nombre: 'Sophie Martin', tipo: 'huesped', temperatura: 'caliente' });
  });

  it('when nothing is free it says so and hands over', async () => {
    const a = app(tour(), flats);
    for (const m of ['RESERVA', 'Leo', 'no', '15/11', '2']) await a.say({ text: m });
    const t = await a.say({ text: '7' });
    expect(last(t).text).toMatch(/no me queda nada libre para 7 personas/);
    expect(a.conv().data.estado).toBe('humano');
    expect(a.of('reserva')).toHaveLength(2);
  });

  it('two people can’t get the same flat on the same nights', async () => {
    const a = app(tour(), flats.filter((f) => f.id === 'f1'));
    for (const m of ['RESERVA', 'Ana', 'no', '20/11', '2', '2']) await a.say({ text: m, igId: 'ig-1' });
    const b = runBot(tour(), a.rs, { kind: 'dm', text: 'RESERVA', username: 'otra', igId: 'ig-2' }, { now: NOW, newId: () => 'z' });
    expect(b.handled).toBe(true);
    // Ana picks it now…
    await a.say({ text: 'Loft Carmen', igId: 'ig-1' });
    expect(a.of('reserva')).toHaveLength(1);
    // …and someone asking for the same nights is told there is nothing.
    const other = app(tour(), a.rs.filter((r) => r.entity !== 'conversacion' && r.entity !== 'contacto_inmo'));
    for (const m of ['RESERVA', 'Leo', 'no', '21/11', '2']) await other.say({ text: m });
    expect(last(await other.say({ text: '1' })).text).toMatch(/no me queda nada libre/);
  });
});

describe('Asistente de Instagram: validación, cambios y la IA', () => {
  it('refuses a broken assistant with clear reasons', () => {
    const bp = composePack('ambos', 'A');
    const bad = clone(bp);
    bad.bot!.keywords = ['X', 'INFO', 'info'];
    bad.bot!.warm = 90;
    bad.bot!.questions.push({ key: 'q', text: '¿Estado?', entity: 'conversacion', field: 'estado' });
    bad.bot!.questions.push({ key: 'r', text: '¿Busca?', entity: 'conversacion', field: 'interes', options: [{ label: 'Un nombre larguísimo de botón', value: 'comprar' }, { label: 'Otro', value: 'nope' }] });
    bad.bot!.rules.push({ entity: 'conversacion', field: 'zona', op: 'gte', value: 3, points: 500 });
    const errors = validateBlueprint(bad).join('\n');
    expect(errors).toMatch(/entre 2 y 30 letras/);
    expect(errors).toMatch(/palabra clave repetida «info»/);
    expect(errors).toMatch(/«templado desde» no puede ser mayor/);
    expect(errors).toMatch(/«Estado» lo rellena el asistente solo/);
    expect(errors).toMatch(/entre 1 y 20 caracteres/);
    expect(errors).toMatch(/«nope» no es una opción de «Busca»/);
    expect(errors).toMatch(/necesita un campo numérico/);
    expect(errors).toMatch(/los puntos van de −100 a 100/);
    const noAgenda = clone(bp);
    noAgenda.views.find((v) => v.key === 'contactos_inmo')!.availability = undefined;
    noAgenda.views.find((v) => v.key === 'contactos_inmo')!.actions = noAgenda.views.find((v) => v.key === 'contactos_inmo')!.actions!.filter((x) => x.kind !== 'schedule');
    for (const v of noAgenda.views) if (v.availability && v.key !== 'instagram') v.availability = undefined;
    noAgenda.views = noAgenda.views.filter((v) => v.key !== 'instagram');
    expect(validateBlueprint(noAgenda).join()).toMatch(/horario en la lista de Contactos/);
  });

  it('shows the assistant’s changes in plain words before applying', () => {
    const before = composePack('compraventa', 'A');
    delete before.bot;
    const after = composePack('compraventa', 'A');
    expect(diffBlueprints(before, after).map((c) => c.text)).toContain('Activar el asistente de instagram: responde a «INFO», «PISO» y «VISITA» y a mensajes directos, hace 5 preguntas y al final ofrece huecos de la agenda y deja la cita apuntada.');
    const edited = clone(after);
    edited.bot!.keywords = ['CASA'];
    edited.bot!.questions = edited.bot!.questions.slice(1).reverse();
    edited.bot!.questions.push({ key: 'm2', text: '¿Cuántos metros?', entity: 'conversacion', field: 'huespedes' });
    edited.bot!.finish = { mode: 'humano' };
    const text = diffBlueprints(after, edited).map((c) => c.text);
    expect(text).toEqual(expect.arrayContaining([
      'Asistente de Instagram: palabras clave «CASA».',
      'Asistente de Instagram: nueva pregunta «¿Cuántos metros?».',
      'Asistente de Instagram: quitar la pregunta «¿Qué estás buscando?».',
      'Asistente de Instagram: nuevo orden de las preguntas.',
      'Asistente de Instagram: al final pasa el lead a una persona del equipo.',
    ]));
    const off = clone(after);
    off.bot!.enabled = false;
    expect(diffBlueprints(after, off).map((c) => c.text)).toEqual(['Apagar el asistente de instagram. Las conversaciones se quedan.']);
  });

  it('the AI keeps the assistant as it is and can’t break it', async () => {
    const current = composePack('compraventa', 'A');
    current.bot = { ...current.bot!, auto: false, keywords: ['CASA'] };
    const stripped = clone(current);
    delete stripped.bot;
    const broken = clone(stripped);
    broken.entities.find((e) => e.key === 'conversacion')!.fields = broken.entities.find((e) => e.key === 'conversacion')!.fields.filter((f) => f.key !== 'plazo');
    const renamed = clone(stripped);
    renamed.name = 'B';
    const sent: unknown[] = [];
    const script = [broken, { ...renamed, bot: { enabled: false } }];
    const callModel: CallModel = async (req) => {
      sent.push(req.messages.at(-1));
      const plano = script.shift();
      return { content: [{ type: 'tool_use', id: `t${sent.length}`, name: 'proponer_cambios', input: { resumen: 'Cambio', plano } }], stop_reason: 'tool_use' };
    };
    const res = await runAgent({ callModel, current, history: [], message: 'quita el plazo' });
    expect(JSON.stringify(sent[1])).toMatch(/rompe el asistente de Instagram/);
    expect(res.proposal?.blueprint.name).toBe('B');
    // What the model wrote in «bot» is ignored: the app keeps its own.
    expect(res.proposal?.blueprint.bot).toEqual(current.bot);
  });

  it('slot labels fit an Instagram button', () => {
    expect(slotLabel('2026-10-15T10:00')).toBe('jue 15 oct · 10:00');
    expect(slotLabel('2026-12-30T17:30').length).toBeLessThanOrEqual(20);
  });
});
