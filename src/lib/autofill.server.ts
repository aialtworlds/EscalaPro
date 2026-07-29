// Helpers de servidor do gerador de escala.
//
// Vive fora do arquivo de server functions de propósito: o bundler remove os
// corpos dos handlers e levaria helpers vizinhos com eles.
import { type AutoConstraint, type AutoDemand, type AutoEmployee, type AutoLimits } from "@/lib/autofill";
import { resolveParams } from "@/lib/clt/resolve";
import type { ComplianceProfile } from "@/lib/clt/params";

export const addDays = (i: string, days: number) => {
  const d = new Date(`${i}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Dias do período pedido: 7 a partir da data, ou o mês civil que a contém. */
export function periodDays(start: string, mode: "week" | "month") {
  if (mode === "week") return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = `${start.slice(0, 7)}-01`;
  return Array.from({ length: total }, (_, i) => addDays(first, i));
}

/** Semanas (segundas) tocadas pelo período — usadas nos pontos de restauração. */
export function weekStarts(days: string[]) {
  const set = new Set<string>();
  for (const day of days) {
    const d = new Date(`${day}T00:00:00Z`);
    const wd = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (wd === 0 ? -6 : 1 - wd));
    set.add(d.toISOString().slice(0, 10));
  }
  return [...set].sort();
}

const PJ_LIMITS: AutoLimits = {
  journeyHours: 12,
  maxOvertimeHours: 0,
  weeklyHours: 60,
  interJourneyHours: 8,
  maxDaysPerWeek: 7,
};

type EmployeeRow = {
  id: string;
  name: string;
  sector_id: string | null;
  role_profile: string;
  journey_hours: number | string;
  compliance_profiles?: unknown;
};

/** Traduz o cadastro real do gestor nos limites que o motor usa. */
export function limitsFor(row: EmployeeRow, date: string): AutoLimits {
  if (row.role_profile === "pj") return PJ_LIMITS;
  const profile = (row.compliance_profiles ?? null) as ComplianceProfile | null;
  const { params } = resolveParams(profile, date);
  const journey = Number(row.journey_hours);
  return {
    journeyHours: Number.isFinite(journey) && journey > 0 ? journey : params.journeyHours,
    maxOvertimeHours: params.maxOvertimeHours,
    weeklyHours: params.weeklyHours,
    interJourneyHours: params.interJourneyHours,
    maxDaysPerWeek: Math.max(1, params.maxConsecutiveDays),
  };
}

// Client autenticado do middleware, tipado de forma frouxa para não arrastar os
// genéricos gerados do banco até aqui.
type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

export type PlanInputs = {
  demands: AutoDemand[];
  employees: AutoEmployee[];
  constraints: AutoConstraint[];
  existing: { employee_id: string | null; sector_id: string | null; shift_date: string; start_time: string; end_time: string }[];
  start: string;
  end: string;
};

/** Carrega o cadastro real (turnos, colaboradores, restrições) do período. */
export async function loadPlanInputs(
  sb: SupabaseLike,
  days: string[],
  useExisting: boolean,
): Promise<PlanInputs> {
  const start = days[0];
  const end = addDays(days[days.length - 1], 1);

  const [demandsRes, empsRes, consRes] = await Promise.all([
    sb.from("demand_templates").select("*"),
    sb
      .from("employees")
      .select("id, name, sector_id, role_profile, journey_hours, compliance_profiles(*, agreements(*))"),
    sb.from("employee_constraints").select("*"),
  ]);
  if (demandsRes.error) throw new Error(demandsRes.error.message);
  if (empsRes.error) throw new Error(empsRes.error.message);
  if (consRes.error) throw new Error(consRes.error.message);

  const demands = (demandsRes.data ?? []) as AutoDemand[];
  if (!demands.length) throw new Error("Cadastre os turnos de cada setor antes de gerar a escala.");

  const rows = (empsRes.data ?? []) as EmployeeRow[];
  if (!rows.length) throw new Error("Nenhum colaborador cadastrado.");
  const employees: AutoEmployee[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sector_id: r.sector_id,
    role_profile: r.role_profile,
    journey_hours: Number(r.journey_hours),
    limits: limitsFor(r, start),
  }));
  const constraints = (consRes.data ?? []) as AutoConstraint[];

  let existing: PlanInputs["existing"] = [];
  if (useExisting) {
    const { data, error } = await sb
      .from("shifts")
      .select("employee_id, sector_id, shift_date, start_time, end_time")
      .gte("shift_date", start)
      .lt("shift_date", end);
    if (error) throw new Error(error.message);
    existing = data ?? [];
  }

  return { demands, employees, constraints, existing, start, end };
}
