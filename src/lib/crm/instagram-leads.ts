export type LeadQualificationInput = {
  operacion_busca?: unknown;
  presupuesto_max?: unknown;
  zona?: unknown;
  plazo?: unknown;
  financiacion?: unknown;
  telefono?: unknown;
  email?: unknown;
  contacto_autorizado?: unknown;
};

export type LeadQualification = {
  score: number;
  level: 'alta' | 'media' | 'baja';
  missing: string[];
  nextAction: string;
  contactAllowed: boolean;
};

const present = (value: unknown) => value !== undefined && value !== null && String(value).trim().length > 0;

/**
 * Explainable first-pass scoring for real-estate leads. This is a prioritisation
 * aid, not an AI decision or a promise of conversion. It deliberately does not
 * infer consent from a DM, a username, or a high score.
 */
export function qualifyRealEstateLead(input: LeadQualificationInput): LeadQualification {
  let score = 0;
  const missing: string[] = [];

  if (present(input.operacion_busca)) score += 25;
  else missing.push('intención: comprar, alquilar o vender');

  if (Number(input.presupuesto_max) > 0) score += 20;
  else missing.push('presupuesto');

  if (present(input.zona)) score += 15;
  else missing.push('zona de interés');

  const timeline = String(input.plazo ?? '');
  if (['mes', 'trimestre'].includes(timeline)) score += 15;
  else if (['semestre', 'sin_prisa'].includes(timeline)) score += 8;
  else missing.push('plazo');

  const finance = String(input.financiacion ?? '');
  if (['preaprobada', 'no_necesita'].includes(finance)) score += 15;
  else if (finance === 'en_tramite') score += 8;
  else missing.push('situación de financiación');

  if (present(input.telefono) || present(input.email)) score += 10;
  else missing.push('teléfono o email de contacto');

  const level = score >= 70 ? 'alta' : score >= 40 ? 'media' : 'baja';
  const contactAllowed = input.contacto_autorizado === 'confirmado';

  let nextAction = 'Revisar manualmente y completar los datos que falten';
  if (!contactAllowed) nextAction = input.contacto_autorizado === 'no'
    ? 'No iniciar contacto comercial; revisar preferencias y base legal'
    : 'Confirmar el permiso y el canal de contacto antes de iniciar seguimiento';
  else if (missing.length) nextAction = `Contactar por el canal autorizado y completar: ${missing.slice(0, 2).join(' y ')}`;
  else if (level === 'alta') nextAction = 'Asignar al agente disponible y contactar cuanto antes';
  else if (level === 'media') nextAction = 'Asignar a un agente y validar necesidad, presupuesto y plazo';
  else nextAction = 'Completar la cualificación antes de priorizar la oportunidad';

  return { score, level, missing, nextAction, contactAllowed };
}
