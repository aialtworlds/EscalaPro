// Helpers server-side para sugestão de cobertura de falta.
import { checkShiftCompliance, durationMinutes, fmtHours } from "@/lib/clt-rules";
import type { RuleEmployee, RuleShift, Violation } from "@/lib/clt-rules";

export type Candidate = {
  employee_id: string;
  name: string;
  role_label: string;
  same_sector: boolean;
  week_hours: string;
  violations: Violation[];
  blocked: boolean;
};

const ROLE: Record<string, string> = {
  clt_regular: "CLT Regular",
  estagiario: "Estagiário",
  clt_mulher: "CLT Mulher",
};

export function mondayUTC(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export function addDaysUTC(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildCandidates(
  gap: RuleShift,
  employees: (RuleEmployee & { sector_id: string | null })[],
  weekShifts: RuleShift[],
  sectorId: string | null,
): Candidate[] {
  const list: Candidate[] = [];
  for (const e of employees) {
    if (e.id === gap.employee_id) continue;
    const own = weekShifts.filter((s) => s.employee_id === e.id && s.status !== "absent");
    const candidate: RuleShift = { ...gap, id: undefined, employee_id: e.id };
    const violations = checkShiftCompliance(candidate, e, own);
    const weekMin = own.reduce((a, s) => a + durationMinutes(s), 0) + durationMinutes(candidate);
    list.push({
      employee_id: e.id,
      name: e.name ?? "Sem nome",
      role_label: ROLE[e.role_profile] ?? e.role_profile,
      same_sector: !!sectorId && e.sector_id === sectorId,
      week_hours: fmtHours(weekMin),
      violations,
      blocked: violations.some((v) => v.level === "error"),
    });
  }
  // Elegíveis primeiro, depois mesmo setor, depois menor carga semanal.
  return list.sort(
    (a, b) =>
      Number(a.blocked) - Number(b.blocked) ||
      Number(b.same_sector) - Number(a.same_sector) ||
      a.violations.length - b.violations.length ||
      a.week_hours.localeCompare(b.week_hours),
  );
}

export function candidatesPrompt(gap: RuleShift, sectorName: string | null, candidates: Candidate[]): string {
  const lines = candidates
    .slice(0, 12)
    .map(
      (c) =>
        `- ${c.name} (id=${c.employee_id}; ${c.role_label}; ${c.same_sector ? "mesmo setor" : "outro setor"}; ${c.week_hours} na semana; ${
          c.blocked ? "BLOQUEADO CLT: " : c.violations.length ? "ressalvas: " : "sem ressalvas"
        }${c.violations.map((v) => v.message).join(" | ")})`,
    )
    .join("\n");
  return [
    `Preciso cobrir um turno vago de ${gap.start_time.slice(0, 5)} às ${gap.end_time.slice(0, 5)} no dia ${gap.shift_date}${sectorName ? `, setor ${sectorName}` : ""}.`,
    "Candidatos disponíveis:",
    lines,
    "",
    "Escolha até 3 candidatos, do melhor para o pior. Nunca escolha quem está BLOQUEADO CLT.",
    "Priorize mesmo setor, menor carga semanal e ausência de ressalvas.",
    "Para cada escolha devolva employee_id exatamente como informado e uma justificativa curta em português (máx. 140 caracteres).",
  ].join("\n");
}
