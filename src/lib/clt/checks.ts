// Checagens elementares. Cada uma consulta apenas parâmetros resolvidos —
// nenhum limite fica cravado aqui — e devolve a citação da fonte usada.

import type { Check, CheckInput, RuleShift, Violation } from "./types";
import type { ParamKey } from "./params";

export const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

export const dayIndex = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);

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

/** Monta a violação já com a procedência do parâmetro que a originou. */
function mk(
  input: CheckInput,
  key: ParamKey,
  v: Omit<Violation, "basis" | "source" | "overridable"> & { overridable?: boolean },
): Violation {
  const src = input.resolved.sources[key];
  return {
    ...v,
    basis: src.basis,
    source: src.origin,
    // Violação de norma federal cogente nunca é liberável pelo gestor.
    overridable: v.overridable ?? src.origin !== "federal",
  };
}

/** Sobreposição de turnos e descanso entre jornadas. */
export const restBetweenShifts: Check = (input) => {
  const out: Violation[] = [];
  const required = input.resolved.params.interJourneyHours * 60;
  for (const o of input.peers) {
    const os = absSpan(o);
    const overlaps = input.span.start < os.end && os.start < input.span.end;
    if (overlaps) {
      out.push(
        mk(input, "interJourneyHours", {
          code: "sobreposicao",
          level: "error",
          message: "Turno sobreposto a outro do mesmo colaborador.",
          overridable: false,
        }),
      );
      continue;
    }
    const gap = input.span.start >= os.end ? input.span.start - os.end : os.start - input.span.end;
    if (gap < required) {
      out.push(
        mk(input, "interJourneyHours", {
          code: "interjornada",
          level: "error",
          message: `Descanso de apenas ${fmtHours(Math.max(gap, 0))} entre turnos — o mínimo aplicável é ${fmtHours(required)}.`,
        }),
      );
      break;
    }
  }
  return out;
};

/** Jornada diária e teto de horas extras. */
export const dailyJourney: Check = (input) => {
  const { journeyHours, maxOvertimeHours } = input.resolved.params;
  const journey = journeyHours * 60;
  const ceiling = (journeyHours + maxOvertimeHours) * 60;
  if (input.dur > ceiling) {
    return [
      mk(input, maxOvertimeHours > 0 ? "maxOvertimeHours" : "journeyHours", {
        code: "jornada_extrapolada",
        level: "error",
        message:
          maxOvertimeHours > 0
            ? `${fmtHours(input.dur)} no dia excede a jornada de ${journeyHours}h + ${maxOvertimeHours}h extras.`
            : `${fmtHours(input.dur)} no dia excede a jornada de ${journeyHours}h, que não admite hora extra neste regime.`,
      }),
    ];
  }
  if (input.dur > journey) {
    return [
      mk(input, "journeyHours", {
        code: "hora_extra",
        level: "warn",
        message: `${fmtHours(input.dur - journey)} de hora extra sobre a jornada de ${journeyHours}h.`,
        overridable: true,
      }),
    ];
  }
  return [];
};

/** Intervalos intrajornada. */
export const mealBreaks: Check = (input) => {
  const p = input.resolved.params;
  if (input.dur > p.mealBreakAfterHours * 60) {
    return [
      mk(input, "mealBreakMinutes", {
        code: "intrajornada",
        level: "info",
        message: `Jornada acima de ${p.mealBreakAfterHours}h exige ${fmtHours(p.mealBreakMinutes)} de intervalo para refeição.`,
        overridable: true,
      }),
    ];
  }
  if (input.dur > p.shortBreakAfterHours * 60) {
    return [
      mk(input, "shortBreakMinutes", {
        code: "intrajornada_curto",
        level: "info",
        message: `Jornada acima de ${p.shortBreakAfterHours}h exige ${p.shortBreakMinutes} min de intervalo.`,
        overridable: true,
      }),
    ];
  }
  return [];
};

/** Teto semanal. */
export const weeklyLimit: Check = (input) => {
  const limit = input.resolved.params.weeklyHours * 60;
  const total = input.peers.reduce((a, s) => a + durationMinutes(s), 0) + input.dur;
  if (total > limit) {
    return [
      mk(input, "weeklyHours", {
        code: "limite_semanal",
        level: "error",
        message: `${fmtHours(total)} na semana excede o teto de ${input.resolved.params.weeklyHours}h.`,
      }),
    ];
  }
  if (total > limit - 4 * 60) {
    return [
      mk(input, "weeklyHours", {
        code: "limite_semanal_proximo",
        level: "warn",
        message: `${fmtHours(total)} na semana — perto do teto de ${input.resolved.params.weeklyHours}h.`,
        overridable: true,
      }),
    ];
  }
  return [];
};

/** Descanso semanal remunerado. */
export const weeklyRest: Check = (input) => {
  const max = input.resolved.params.maxConsecutiveDays;
  const days = new Set([input.candidate.shift_date, ...input.peers.map((p) => p.shift_date)]);
  const idx = [...days].map(dayIndex).sort((a, b) => a - b);
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < idx.length; i++) {
    run = idx[i] === idx[i - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  if (maxRun > max) {
    return [
      mk(input, "maxConsecutiveDays", {
        code: "dsr",
        level: "error",
        message: `${maxRun} dias seguidos de trabalho — o limite aplicável é ${max} antes do descanso semanal.`,
      }),
    ];
  }
  return [];
};

/** Trabalho em janela noturna (informativo: adicional e hora reduzida). */
export const nightWork: Check = (input) => {
  const p = input.resolved.params;
  const start = toMin(input.candidate.start_time);
  const end = toMin(input.candidate.end_time);
  const crosses = end <= start;
  const touchesNight = crosses || start >= p.nightStartMinutes || end > p.nightStartMinutes || start < p.nightEndMinutes;
  if (!touchesNight) return [];
  return [
    mk(input, "nightStartMinutes", {
      code: "noturno",
      level: "info",
      message: `Turno alcança a janela noturna — adicional noturno e hora reduzida de 52min30s se aplicam.`,
      overridable: true,
    }),
  ];
};

/** Estágio não deve ocorrer em horário noturno. */
export const internNightBan: Check = (input) => {
  if (!nightWork(input).length) return [];
  return [
    mk(input, "nightStartMinutes", {
      code: "estagio_noturno",
      level: "warn",
      message: "Estágio em horário noturno é incompatível com a frequência escolar.",
      overridable: true,
    }),
  ];
};

/** Regimes especiais exigem acordo escrito registrado. */
export const writtenAgreement: Check = (input) => {
  if (!input.resolved.params.requiresWrittenAgreement || input.resolved.hasWrittenAgreement) return [];
  return [
    mk(input, "requiresWrittenAgreement", {
      code: "acordo_ausente",
      level: "warn",
      message: "Este regime só é válido com acordo escrito (individual ou coletivo) registrado no perfil de jornada.",
      overridable: true,
    }),
  ];
};

/** Trabalho em feriado cadastrado. */
export const holidayWork: Check = (input) => {
  const h = input.holidays.find((x) => x.holiday_date === input.candidate.shift_date);
  if (!h) return [];
  return [
    {
      code: "feriado",
      level: "info",
      message: `${h.name} — trabalho em feriado exige compensação ou pagamento em dobro.`,
      basis: "Lei 605/49 art. 9º",
      source: "federal",
      overridable: true,
    },
  ];
};

/** Art. 384 — pausa antes da hora extra (aplicação controvertida, informativo). */
export const art384: Check = (input) => {
  if (input.employee.role_profile !== "clt_mulher") return [];
  if (input.dur <= input.resolved.params.journeyHours * 60) return [];
  return [
    {
      code: "art_384",
      level: "info",
      message: "Antes da hora extra, conceder 15 min de descanso.",
      basis: "CLT art. 384 (aplicação controvertida)",
      source: "federal",
      overridable: true,
    },
  ];
};
