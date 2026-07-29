// Datas e horários em pt-BR.
//
// Regra de ouro: nunca depender do relógio local do processo. O worker roda em
// UTC, então "hoje" precisa ser derivado explicitamente do fuso da operação
// (America/Sao_Paulo) — caso contrário, às 21h BRT o app já viraria o dia.
// Toda a aritmética de datas é feita em UTC sobre ISO puro (YYYY-MM-DD), o que
// também imuniza contra horário de verão.

export const APP_TZ = "America/Sao_Paulo";

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const WEEKDAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

const ISO_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje no fuso da operação, em ISO (YYYY-MM-DD). */
export function todayISO(now: Date = new Date()): string {
  return ISO_FMT.format(now); // en-CA já formata como YYYY-MM-DD
}

/** Ano corrente no fuso da operação. */
export function currentYear(now: Date = new Date()): number {
  return Number(todayISO(now).slice(0, 4));
}

/** Date em UTC representando o dia civil — usado só para cálculo, nunca para exibir hora. */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const toISO = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** Índice do dia da semana (0=Dom) do dia civil informado. */
export function weekdayOf(iso: string): number {
  return isoToDate(iso).getUTCDay();
}

export function formatDatePt(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAY_FULL[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Segunda-feira da semana que contém a data informada. */
export function mondayOf(iso: string): string {
  const d = isoToDate(iso);
  const day = d.getUTCDay(); // 0=Dom
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return toISO(d);
}

export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function trimTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export const ROLE_LABELS: Record<string, string> = {
  clt_regular: "CLT Regular",
  estagiario: "Estagiário",
  clt_mulher: "CLT Mulher",
  escala_12x36: "Escala 12x36",
  pj: "PJ / Prestador",
};

export const WEEKDAY_MAP_PT: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1, "segunda-feira": 1,
  terca: 2, "terça": 2, ter: 2, "terça-feira": 2,
  quarta: 3, qua: 3, "quarta-feira": 3,
  quinta: 4, qui: 4, "quinta-feira": 4,
  sexta: 5, sex: 5, "sexta-feira": 5,
  sabado: 6, "sábado": 6, sab: 6,
};

// ---------------------------------------------------------------- durações
//
// Jornadas raramente são inteiras (9h40, 7h20). O banco guarda horas decimais,
// mas o gestor só digita HH:MM — a conversão fica centralizada aqui.

/** Aceita "9:40", "9h40", "0940", "9,5" ou "9.5" e devolve minutos. */
export function parseDurationToMinutes(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s/g, "");
  if (!raw) return null;
  let m = raw.match(/^(\d{1,3})[:h](\d{1,2})?$/);
  if (m) {
    const min = Number(m[2] ?? 0);
    if (min > 59) return null;
    return Number(m[1]) * 60 + min;
  }
  m = raw.match(/^(\d{1,3})[.,](\d{1,2})$/);
  if (m) return Math.round(Number(`${m[1]}.${m[2]}`) * 60);
  m = raw.match(/^(\d{3,4})$/);
  if (m) {
    const s = m[1].padStart(4, "0");
    const min = Number(s.slice(2));
    if (min > 59) return null;
    return Number(s.slice(0, 2)) * 60 + min;
  }
  m = raw.match(/^(\d{1,3})h?$/);
  if (m) return Number(m[1]) * 60;
  return null;
}

export function minutesToHHMM(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Horas decimais (8.5) → "08:30". */
export function hoursToHHMM(hours: number | string | null | undefined): string {
  const h = Number(hours);
  if (!Number.isFinite(h)) return "";
  return minutesToHHMM(h * 60);
}

/** "09:40" → 9.666... (horas decimais, como o banco guarda). */
export function hhmmToHours(input: string): number | null {
  const min = parseDurationToMinutes(input);
  return min === null ? null : Math.round((min / 60) * 10000) / 10000;
}

/** Aceita "8", "08:00", "8h30" para campos de horário do relógio. */
export function parseClockTime(input: string): string | null {
  const min = parseDurationToMinutes(input);
  if (min === null || min > 23 * 60 + 59) return null;
  return minutesToHHMM(min);
}
