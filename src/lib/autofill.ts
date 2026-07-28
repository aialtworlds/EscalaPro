// Motor puro de montagem automática da escala.
//
// Determinístico de propósito: dado o mesmo cadastro, a mesma semana sai igual.
// A IA fica de fora aqui — o gestor precisa conseguir explicar por que fulano
// caiu na terça, e uma heurística auditável faz isso melhor que um modelo.

export type AutoEmployee = {
  id: string;
  name: string;
  sector_id: string | null;
  role_profile: string;
  journey_hours: number;
};

export type AutoConstraint = {
  employee_id: string;
  kind: "indisponivel_semanal" | "afastamento";
  weekday: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

export type AutoDemand = {
  id: string;
  sector_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  headcount: number;
};

export type AutoExisting = {
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
};

export type PlannedShift = {
  employee_id: string;
  sector_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
};

export type AutofillGap = {
  shift_date: string;
  sector_id: string | null;
  start_time: string;
  end_time: string;
  reason: string;
};

export type AutofillPlan = {
  planned: PlannedShift[];
  gaps: AutofillGap[];
};

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

const dayIdx = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

/** Intervalo absoluto em minutos desde a época, tratando virada de meia-noite. */
function span(date: string, start: string, end: string) {
  const base = dayIdx(date) * 1440;
  const s = base + toMin(start);
  let e = base + toMin(end);
  if (e <= s) e += 1440;
  return { s, e };
}

const overlaps = (a: { s: number; e: number }, b: { s: number; e: number }) => a.s < b.e && b.s < a.e;

/** A restrição bloqueia esse colaborador nesse intervalo? */
export function isBlocked(c: AutoConstraint, date: string, start: string, end: string): boolean {
  if (c.kind === "afastamento") {
    if (c.start_date && date < c.start_date) return false;
    if (c.end_date && date > c.end_date) return false;
    return true;
  }
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (c.weekday !== wd) return false;
  if (!c.start_time || !c.end_time) return true; // dia inteiro
  return overlaps(span(date, start, end), span(date, c.start_time, c.end_time));
}

export type AutofillOptions = {
  /** Descanso mínimo entre jornadas, em horas. Padrão CLT: 11. */
  interJourneyHours?: number;
  /** Teto semanal de horas. Padrão CLT: 44. */
  weeklyHours?: number;
  /** Máximo de dias trabalhados na semana (DSR). Padrão: 6. */
  maxDaysPerWeek?: number;
};

/**
 * Monta a escala de uma semana a partir dos modelos de demanda.
 * Nunca sobrescreve turno existente: ele entra como carga já alocada.
 */
export function buildWeekPlan(input: {
  days: string[];
  demands: AutoDemand[];
  employees: AutoEmployee[];
  constraints: AutoConstraint[];
  existing: AutoExisting[];
  options?: AutofillOptions;
}): AutofillPlan {
  const interJourney = (input.options?.interJourneyHours ?? 11) * 60;
  const weeklyCap = (input.options?.weeklyHours ?? 44) * 60;
  const maxDays = input.options?.maxDaysPerWeek ?? 6;

  // Carga já existente por colaborador (turnos que o gestor criou na mão).
  const load = new Map<string, { minutes: number; days: Set<string>; spans: { s: number; e: number }[] }>();
  const bucket = (id: string) => {
    let b = load.get(id);
    if (!b) { b = { minutes: 0, days: new Set(), spans: [] }; load.set(id, b); }
    return b;
  };
  for (const e of input.existing) {
    if (!e.employee_id) continue;
    const sp = span(e.shift_date, e.start_time, e.end_time);
    const b = bucket(e.employee_id);
    b.minutes += sp.e - sp.s;
    b.days.add(e.shift_date);
    b.spans.push(sp);
  }

  const planned: PlannedShift[] = [];
  const gaps: AutofillGap[] = [];

  for (const date of input.days) {
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    const todays = input.demands
      .filter((d) => d.weekday === wd)
      .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));

    for (const demand of todays) {
      const sp = span(date, demand.start_time, demand.end_time);
      const duration = sp.e - sp.s;

      // Quantos já cobrem esse bloco (turno existente no mesmo setor e horário).
      const alreadyCovered = input.existing.filter(
        (e) => e.shift_date === date && overlaps(span(e.shift_date, e.start_time, e.end_time), sp),
      ).length;
      const needed = Math.max(0, demand.headcount - alreadyCovered);

      for (let slot = 0; slot < needed; slot++) {
        const reasons: string[] = [];
        const candidates = input.employees.filter((emp) => {
          const b = bucket(emp.id);
          if (b.spans.some((x) => overlaps(x, sp))) return false;
          if (!b.days.has(date) && b.days.size >= maxDays) { reasons.push("dsr"); return false; }
          if (b.minutes + duration > weeklyCap) { reasons.push("44h"); return false; }
          const restOk = b.spans.every((x) => sp.s >= x.e + interJourney || x.s >= sp.e + interJourney);
          if (!restOk) { reasons.push("11h"); return false; }
          if (input.constraints.some((c) => c.employee_id === emp.id && isBlocked(c, date, demand.start_time, demand.end_time)))
            return false;
          return true;
        });

        if (!candidates.length) {
          gaps.push({
            shift_date: date,
            sector_id: demand.sector_id,
            start_time: demand.start_time,
            end_time: demand.end_time,
            reason: reasons.length
              ? "Sem colaborador elegível (limites de jornada/descanso)."
              : "Sem colaborador disponível (restrições ou afastamentos).",
          });
          continue;
        }

        // Prioridade: setor certo → menos horas na semana → nome (estabilidade).
        candidates.sort((a, b) => {
          const sa = a.sector_id === demand.sector_id ? 0 : 1;
          const sb = b.sector_id === demand.sector_id ? 0 : 1;
          if (sa !== sb) return sa - sb;
          const ma = bucket(a.id).minutes;
          const mb = bucket(b.id).minutes;
          if (ma !== mb) return ma - mb;
          return a.name.localeCompare(b.name, "pt-BR");
        });

        const chosen = candidates[0];
        const b = bucket(chosen.id);
        b.minutes += duration;
        b.days.add(date);
        b.spans.push(sp);
        planned.push({
          employee_id: chosen.id,
          sector_id: demand.sector_id,
          shift_date: date,
          start_time: demand.start_time,
          end_time: demand.end_time,
        });
      }
    }
  }

  return { planned, gaps };
}
