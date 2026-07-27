// Cada regime escolhe quais checagens fazem sentido para ele.
import {
  art384,
  dailyJourney,
  holidayWork,
  internNightBan,
  mealBreaks,
  nightWork,
  restBetweenShifts,
  weeklyLimit,
  weeklyRest,
  writtenAgreement,
} from "./checks";
import type { Check } from "./types";
import type { WorkRegime } from "./params";

const PADRAO: Check[] = [
  restBetweenShifts,
  dailyJourney,
  mealBreaks,
  weeklyLimit,
  weeklyRest,
  nightWork,
  holidayWork,
  art384,
];

// 12x36 / 24x72: a jornada longa é da essência do regime; o que importa é o
// descanso subsequente e a existência do acordo escrito. Não há checagem de
// dias consecutivos porque o descanso já cobre isso.
const ESCALA_ESPECIAL: Check[] = [
  writtenAgreement,
  restBetweenShifts,
  dailyJourney,
  mealBreaks,
  weeklyLimit,
  nightWork,
  holidayWork,
];

const ESTAGIO: Check[] = [restBetweenShifts, dailyJourney, mealBreaks, weeklyLimit, weeklyRest, internNightBan, holidayWork];

const PARCIAL: Check[] = [restBetweenShifts, dailyJourney, mealBreaks, weeklyLimit, weeklyRest, nightWork, holidayWork, art384];

const INTERMITENTE: Check[] = [restBetweenShifts, dailyJourney, mealBreaks, nightWork, holidayWork];

export const REGIME_CHECKS: Record<WorkRegime, Check[]> = {
  padrao_5x2: PADRAO,
  padrao_6x1: PADRAO,
  escala_12x36: ESCALA_ESPECIAL,
  escala_24x72: ESCALA_ESPECIAL,
  estagio: ESTAGIO,
  parcial: PARCIAL,
  intermitente: INTERMITENTE,
};
