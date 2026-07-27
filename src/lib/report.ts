// Tipos e helpers puros do relatório mensal (client-safe).

export type EmployeeReport = {
  employee_id: string;
  name: string;
  role_profile: string;
  sector: string | null;
  shifts: number;
  minutes: number;
  extraMinutes: number;
  absences: number;
  violations: { code: string; message: string; level: string; date: string }[];
};

/** Primeiro e último dia do mês "YYYY-MM", em ISO, sem depender do fuso local. */
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export const fmtMinutes = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

export const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} / ${y}`;
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
