// Feriados nacionais fixos + móveis (calculados a partir da Páscoa).
// Server-only: usado apenas pela importação em massa.

export type NationalHoliday = { date: string; name: string };

/** Algoritmo de Meeus/Jones/Butcher para o domingo de Páscoa. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

export function NATIONAL_HOLIDAYS(year: number): NationalHoliday[] {
  const p = easter(year);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fixed: [number, number, string][] = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência do Brasil"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [11, 20, "Consciência Negra"],
    [12, 25, "Natal"],
  ];
  return [
    ...fixed.map(([m, d, name]) => ({ date: `${year}-${pad(m)}-${pad(d)}`, name })),
    { date: iso(shift(p, -48)), name: "Carnaval" },
    { date: iso(shift(p, -47)), name: "Carnaval" },
    { date: iso(shift(p, -2)), name: "Sexta-feira Santa" },
    { date: iso(shift(p, 60)), name: "Corpus Christi" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
