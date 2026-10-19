import type { AppRecord } from '@shared/blueprint/types';

// Conversations are `conversacion` records. The assistant writes the
// transcript as lines "[HH:MM] author: text"; this turns them into bubbles
// without inventing anything that is not in the stored text.

export type Channel = 'instagram' | 'whatsapp' | 'email' | 'web_form' | 'web_chat';
export const CHANNELS: Channel[] = ['instagram', 'whatsapp', 'email', 'web_form', 'web_chat'];
export interface Bubble { time: string; author: string; text: string; direction: 'in' | 'out'; automated: boolean; note: boolean }

const ASSISTANT = /^(asistente|assistant|bot|statehubs)$/i;
const AGENT = /^(agente|agent|equipo|team|tú|you)$/i;
const LINE = /^\[(\d{1,2}:\d{2})\]\s+([^:]{1,80}):\s?(.*)$/;

export function parseTranscript(value: unknown): Bubble[] {
 const text = typeof value === 'string' ? value : '';
 const bubbles: Bubble[] = [];
 for (const raw of text.split('\n')) {
  const line = raw.trimEnd();
  if (!line.trim() || line.trim() === '…') continue;
  const m = LINE.exec(line);
  if (!m) { // Continuation of the previous message.
   if (bubbles.length) bubbles[bubbles.length - 1].text += `\n${line}`;
   continue;
  }
  const [, time, author, body] = m;
  const automated = ASSISTANT.test(author.trim());
  const out = automated || AGENT.test(author.trim());
  const note = /^\((comentario|respuesta a historia|comment|story reply)\)/i.test(body);
  bubbles.push({ time, author: author.trim(), text: body, direction: out ? 'out' : 'in', automated, note });
 }
 return bubbles;
}

export const channelOf = (r: AppRecord): Channel => {
 const v = String(r.data.canal || r.data.channel || 'instagram').toLowerCase();
 return v === 'whatsapp' ? 'whatsapp' : v === 'email' ? 'email' : /form/.test(v) ? 'web_form' : /chat|web/.test(v) ? 'web_chat' : 'instagram';
};
/** Waiting on the team: the person asked for a human, or wrote last. */
export function needsReply(r: AppRecord): boolean {
 if (r.data.estado === 'humano') return true;
 const last = parseTranscript(r.data.transcripcion).at(-1);
 return !!last && last.direction === 'in' && !['descartado', 'agendado', 'reservado'].includes(String(r.data.estado));
}
