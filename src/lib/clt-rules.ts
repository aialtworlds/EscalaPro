// Motor de regras trabalhistas (CLT) — puro, sem dependências de servidor.
// Usado tanto no cliente (validação ao criar/editar turno) quanto no servidor
// (filtro de candidatos à cobertura).

export type RuleShift = {
  id?: string;
  employee_id: string | null;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM[:SS]
  end_time: string;
  status?: string;
  is_freelancer?: boolean;
};

export type RuleEmployee = {
  id: string;
  name?: string;
  role_profile: string; // clt_regular | estagiario | clt_mulher
  journey_hours?: number | string | null;
};

export type Violation = {
  code: string;
  level: "error" | "warn" | "info";
  message: string;
};

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

const dayIndex = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

/** Início e fim absolutos em minutos desde a época (trata turno que vira o dia). */
export function absSpan(s: RuleShift): { start: number; end: number } {
  const base = dayIndex(s.shift_date) * 1440;
  const start = base + toMin(s.start_time);
  let end = base + toMin(s.end_time);
  if (end <= start) end += 1440; // atravessa a meia-noite
  return { start, end };
}

export function durationMinutes(s: RuleShift): number {
  const { start, end } = absSpan(s);
  return end - start;
}

export const fmtHours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

const journeyOf = (e: RuleEmployee) => {
  const n = Number(e.journey_hours ?? 8);
  return Number.isFinite(n) && n > 0 ? n : 8;
};

const WEEK_LIMIT_MIN = 44 * 60;
const INTERN_WEEK_LIMIT_MIN = 30 * 60;
const INTERVAL_MIN = 11 * 60;

/**
 * Avalia um turno (novo ou editado) contra as demais escalas do colaborador.
 * `others` deve conter os turnos da mesma semana (excluindo o avaliado).
 */
export function checkShiftCompliance(
  candidate: RuleShift,
  employee: RuleEmployee | null | undefined,
  others: RuleShift[],
): Violation[] {
  const v: Violation[] = [];
  if (!employee) return v; // freelancer avulso: sem vínculo CLT a validar

  const isIntern = employee.role_profile === "estagiario";
  const journey = isIntern ? Math.min(journeyOf(employee), 6) : journeyOf(employee);
  const dur = durationMinutes(candidate);
  const span = absSpan(candidate);

  const peers = others.filter(
    (o) => o.employee_id === candidate.employee_id && o.id !== candidate.id && o.status !== "absent",
  );

  // 1. Intervalo interjornada de 11h (art. 66)
  for (const o of peers) {
    const os = absSpan(o);
    const gap = span.start >= os.end ? span.start - os.end : os.start - span.end;
    const overlaps = span.start < os.end && os.start < span.end;
    if (overlaps) {
      v.push({ code: "sobreposicao", level: "error", message: "Turno sobreposto a outro do mesmo colaborador." });
    } else if (gap < INTERVAL_MIN) {
      v.push({
        code: "interjornada_11h",
        level: "error",
        message: `Descanso de apenas ${fmtHours(Math.max(gap, 0))} entre turnos — a CLT exige 11h (art. 66).`,
      });
    }
  }

  // 2. Jornada diária
  if (isIntern) {
    if (dur > 6 * 60) {
      v.push({
        code: "estagio_6h",
        level: "error",
        message: `Estagiário com ${fmtHours(dur)} no dia — limite legal é 6h (Lei 11.788).`,
      });
    }
  } else if (dur > (journey + 2) * 60) {
    v.push({
      code: "jornada_extrapolada",
      level: "error",
      message: `${fmtHours(dur)} no dia excede a jornada de ${journey}h + 2h extras (art. 59).`,
    });
  } else if (dur > journey * 60) {
    v.push({
      code: "hora_extra",
      level: "warn",
      message: `${fmtHours(dur - journey * 60)} de hora extra sobre a jornada de ${journey}h.`,
    });
  }

  // 3. Intervalo intrajornada (art. 71)
  if (dur > 6 * 60) {
    v.push({
      code: "intrajornada",
      level: "info",
      message: "Jornada acima de 6h exige 1h de intervalo para refeição.",
    });
  } else if (dur > 4 * 60 && dur <= 6 * 60) {
    v.push({
      code: "intrajornada_15",
      level: "info",
      message: "Jornada entre 4h e 6h exige 15 min de intervalo.",
    });
  }

  // 4. Trabalho noturno de estagiário
  const endLocal = toMin(candidate.end_time);
  const startLocal = toMin(candidate.start_time);
  const touchesNight = endLocal <= startLocal || endLocal > 22 * 60 || startLocal >= 22 * 60;
  if (isIntern && touchesNight) {
    v.push({ code: "estagio_noturno", level: "warn", message: "Estágio em horário noturno não é recomendado." });
  }

  // 5. Limite semanal
  const weekTotal = peers.reduce((acc, o) => acc + durationMinutes(o), 0) + dur;
  const limit = isIntern ? INTERN_WEEK_LIMIT_MIN : WEEK_LIMIT_MIN;
  if (weekTotal > limit) {
    v.push({
      code: "limite_semanal",
      level: "error",
      message: `${fmtHours(weekTotal)} na semana excede o limite de ${limit / 60}h.`,
    });
  } else if (weekTotal > limit - 4 * 60) {
    v.push({
      code: "limite_semanal_proximo",
      level: "warn",
      message: `${fmtHours(weekTotal)} na semana — perto do teto de ${limit / 60}h.`,
    });
  }

  // 6. Descanso semanal remunerado (7 dias seguidos)
  const days = new Set([candidate.shift_date, ...peers.map((p) => p.shift_date)]);
  const idx = [...days].map(dayIndex).sort((a, b) => a - b);
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < idx.length; i++) {
    run = idx[i] === idx[i - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  if (maxRun >= 7) {
    v.push({
      code: "dsr",
      level: "error",
      message: "7 dias seguidos de trabalho — falta o descanso semanal remunerado.",
    });
  }

  // 7. Art. 384 (pausa antes da hora extra para mulheres) — informativo
  if (employee.role_profile === "clt_mulher" && dur > journey * 60) {
    v.push({
      code: "art_384",
      level: "info",
      message: "Antes da hora extra, conceder 15 min de descanso (art. 384).",
    });
  }

  return v;
}

export const worstLevel = (vs: Violation[]): "error" | "warn" | "info" | null =>
  vs.some((x) => x.level === "error") ? "error" : vs.some((x) => x.level === "warn") ? "warn" : vs.length ? "info" : null;
