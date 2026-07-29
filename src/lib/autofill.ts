// Motor puro de montagem automática da escala.
//
// Determinístico de propósito: dado o mesmo cadastro, a mesma semana sai igual.
// A IA fica de fora aqui — o gestor precisa conseguir explicar por que fulano
// caiu na terça, e uma heurística auditável faz isso melhor que um modelo.

/** Limites efetivos do colaborador, já resolvidos (federal → regime → CCT → acordo). */
export type AutoLimits = {
  /** Jornada diária contratual, em horas. */
  journeyHours: number;
  /** Extras diárias toleradas acima da jornada. */
  maxOvertimeHours: number;
  /** Teto semanal, em horas. */
  weeklyHours: number;
  /** Descanso mínimo entre jornadas, em horas. */
  interJourneyHours: number;
  /** Máximo de dias trabalhados por semana (DSR). */
  maxDaysPerWeek: number;
};

export type AutoEmployee = {
  id: string;
  name: string;
  sector_id: string | null;
  role_profile: string;
  journey_hours: number;
  /** Ausente = usa os padrões federais das opções. */
  limits?: AutoLimits;
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
  /** Nome do turno ("Manhã", "Noite") — só para exibição na prévia. */
  label?: string | null;
  /** Só colaboradores do próprio setor podem cobrir este turno. */
  sector_only?: boolean | null;
};

export type AutoExisting = {
  employee_id: string | null;
  sector_id?: string | null;
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
  /** Nome do turno de origem — não é gravado, serve à revisão do gestor. */
  label?: string | null;
};

export type AutofillGap = {
  shift_date: string;
  sector_id: string | null;
  start_time: string;
  end_time: string;
  reason: string;
  label?: string | null;
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

/** Segunda-feira (em índice de dia) que contém a data — base do teto semanal. */
const weekKey = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const wd = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (wd === 0 ? -6 : 1 - wd));
  return d.toISOString().slice(0, 10);
};

/**
 * Monta a escala de um período (semana ou mês) a partir dos turnos de demanda.
 * Nunca sobrescreve turno existente: ele entra como carga já alocada.
 * Cada colaborador é avaliado com os SEUS limites (regime + convenção + acordo).
 */
export function buildWeekPlan(input: {
  days: string[];
  demands: AutoDemand[];
  employees: AutoEmployee[];
  constraints: AutoConstraint[];
  existing: AutoExisting[];
  options?: AutofillOptions;
}): AutofillPlan {
  const fallback: AutoLimits = {
    journeyHours: 8,
    maxOvertimeHours: 2,
    weeklyHours: input.options?.weeklyHours ?? 44,
    interJourneyHours: input.options?.interJourneyHours ?? 11,
    maxDaysPerWeek: input.options?.maxDaysPerWeek ?? 6,
  };
  const limitsOf = (e: AutoEmployee): AutoLimits => e.limits ?? fallback;

  // Carga já existente por colaborador (turnos que o gestor criou na mão),
  // contabilizada por semana civil para que o mês respeite o teto semanal.
  type Bucket = { weekMinutes: Map<string, number>; days: Set<string>; spans: { s: number; e: number }[] };
  const load = new Map<string, Bucket>();
  const bucket = (id: string) => {
    let b = load.get(id);
    if (!b) { b = { weekMinutes: new Map(), days: new Set(), spans: [] }; load.set(id, b); }
    return b;
  };
  const weekMin = (b: Bucket, date: string) => b.weekMinutes.get(weekKey(date)) ?? 0;
  const addWeekMin = (b: Bucket, date: string, min: number) =>
    b.weekMinutes.set(weekKey(date), weekMin(b, date) + min);
  const daysInWeek = (b: Bucket, date: string) => {
    const k = weekKey(date);
    let n = 0;
    for (const d of b.days) if (weekKey(d) === k) n++;
    return n;
  };

  for (const e of input.existing) {
    if (!e.employee_id) continue;
    const sp = span(e.shift_date, e.start_time, e.end_time);
    const b = bucket(e.employee_id);
    addWeekMin(b, e.shift_date, sp.e - sp.s);
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
      const sectorOnly = demand.sector_only !== false && !!demand.sector_id;

      // Quantos já cobrem esse turno: mesmo setor (quando o turno tem setor) e horário.
      const alreadyCovered = input.existing.filter(
        (e) =>
          e.shift_date === date &&
          (!demand.sector_id || (e.sector_id ?? null) === demand.sector_id) &&
          overlaps(span(e.shift_date, e.start_time, e.end_time), sp),
      ).length;
      const needed = Math.max(0, demand.headcount - alreadyCovered);

      for (let slot = 0; slot < needed; slot++) {
        const reasons: string[] = [];
        const candidates = input.employees.filter((emp) => {
          // Separação por setor: o turno da Cozinha não cai em quem é do Salão.
          if (sectorOnly && emp.sector_id !== demand.sector_id) { reasons.push("setor"); return false; }
          const lim = limitsOf(emp);
          const b = bucket(emp.id);
          if (b.spans.some((x) => overlaps(x, sp))) return false;
          // O turno não pode estourar a jornada diária + extras do colaborador.
          if (duration > (lim.journeyHours + lim.maxOvertimeHours) * 60) { reasons.push("jornada"); return false; }
          if (!b.days.has(date) && daysInWeek(b, date) >= lim.maxDaysPerWeek) { reasons.push("dsr"); return false; }
          if (weekMin(b, date) + duration > lim.weeklyHours * 60) { reasons.push("semanal"); return false; }
          const rest = lim.interJourneyHours * 60;
          const restOk = b.spans.every((x) => sp.s >= x.e + rest || x.s >= sp.e + rest);
          if (!restOk) { reasons.push("interjornada"); return false; }
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
            label: demand.label ?? null,
            reason: reasons.length
              ? `Sem colaborador elegível (${[...new Set(reasons)].join(", ")}).`
              : "Sem colaborador disponível (restrições ou afastamentos).",
          });
          continue;
        }

        // Prioridade: setor certo → menos horas na semana → nome (estabilidade).
        candidates.sort((a, b) => {
          const sa = a.sector_id === demand.sector_id ? 0 : 1;
          const sb = b.sector_id === demand.sector_id ? 0 : 1;
          if (sa !== sb) return sa - sb;
          const ma = weekMin(bucket(a.id), date);
          const mb = weekMin(bucket(b.id), date);
          if (ma !== mb) return ma - mb;
          return a.name.localeCompare(b.name, "pt-BR");
        });

        const chosen = candidates[0];
        const b = bucket(chosen.id);
        addWeekMin(b, date, duration);
        b.days.add(date);
        b.spans.push(sp);
        planned.push({
          employee_id: chosen.id,
          sector_id: demand.sector_id,
          shift_date: date,
          start_time: demand.start_time,
          end_time: demand.end_time,
          label: demand.label ?? null,
        });
      }
    }
  }

  return { planned, gaps };
}
