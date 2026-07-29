import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWeekPlan, type AutoConstraint, type AutoDemand, type AutoEmployee, type AutoLimits } from "@/lib/autofill";
import { resolveParams } from "@/lib/clt/resolve";
import type { ComplianceProfile } from "@/lib/clt/params";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const addDays = (i: string, days: number) => {
  const d = new Date(`${i}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Dias do período pedido: 7 a partir da data, ou o mês civil que a contém. */
function periodDays(start: string, mode: "week" | "month") {
  if (mode === "week") return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = `${start.slice(0, 7)}-01`;
  return Array.from({ length: total }, (_, i) => addDays(first, i));
}

/** Semanas (segundas) tocadas pelo período — usadas nos pontos de restauração. */
function weekStarts(days: string[]) {
  const set = new Set<string>();
  for (const iso of days) {
    const d = new Date(`${iso}T00:00:00Z`);
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
function limitsFor(row: EmployeeRow, date: string): AutoLimits {
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

async function loadPlanInputs(sb: SupabaseLike, days: string[], useExisting: boolean) {
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

  const demands = (demandsRes.data ?? []) as unknown as AutoDemand[];
  if (!demands.length) throw new Error("Cadastre os turnos de cada setor antes de gerar a escala.");

  const rows = (empsRes.data ?? []) as unknown as EmployeeRow[];
  if (!rows.length) throw new Error("Nenhum colaborador cadastrado.");
  const employees: AutoEmployee[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sector_id: r.sector_id,
    role_profile: r.role_profile,
    journey_hours: Number(r.journey_hours),
    limits: limitsFor(r, start),
  }));
  const constraints = (consRes.data ?? []) as unknown as AutoConstraint[];

  let existing: { employee_id: string | null; sector_id: string | null; shift_date: string; start_time: string; end_time: string }[] = [];
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

// O client autenticado do middleware; tipado de forma frouxa para manter o
// helper legível sem arrastar os genéricos gerados do banco.
type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

const input = z.object({
  week_start: iso,
  /** "week" = 7 dias a partir da data; "month" = mês civil da data. */
  mode: z.enum(["week", "month"]).default("week"),
  /** true = limpa o período antes (mantendo snapshot), false = só completa lacunas. */
  replace: z.boolean().default(false),
  /** Prévia: calcula e devolve o plano sem gravar nada. */
  preview: z.boolean().default(true),
});

export const autofillWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const days = periodDays(data.week_start, data.mode);
    const { demands, employees, constraints, existing, start, end } = await loadPlanInputs(
      sb as unknown as SupabaseLike,
      days,
      !data.replace,
    );

    const plan = buildWeekPlan({ days, demands, employees, constraints, existing });
    const byId = new Map(employees.map((e) => [e.id, e.name]));

    if (data.preview) {
      return {
        preview: true as const,
        inserted: 0,
        planned: plan.planned.map((p) => ({ ...p, employee_name: byId.get(p.employee_id) ?? "" })),
        gaps: plan.gaps,
      };
    }

    const { snapshotWeek } = await import("@/lib/snapshots.server");
    for (const w of weekStarts(days)) {
      await snapshotWeek(sb, context.userId, w, data.replace ? "Antes de regerar" : "Antes de completar");
    }

    if (data.replace) {
      const { error } = await sb.from("shifts").delete().gte("shift_date", start).lt("shift_date", end);
      if (error) throw new Error(error.message);
    }

    if (plan.planned.length) {
      const rows = plan.planned.map((p) => ({
        employee_id: p.employee_id,
        sector_id: p.sector_id,
        shift_date: p.shift_date,
        start_time: p.start_time,
        end_time: p.end_time,
        owner_id: context.userId,
      }));
      const { error } = await sb.from("shifts").insert(rows);
      if (error) throw new Error(error.message);
    }

    await sb.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "week.autofilled",
      payload: { week: data.week_start, mode: data.mode, count: plan.planned.length, gaps: plan.gaps.length },
    });

    return {
      preview: false as const,
      inserted: plan.planned.length,
      planned: plan.planned.map((p) => ({ ...p, employee_name: byId.get(p.employee_id) ?? "" })),
      gaps: plan.gaps,
    };
  });

const planRow = z.object({
  employee_id: z.string().uuid(),
  sector_id: z.string().uuid().nullable().default(null),
  shift_date: iso,
  start_time: z.string(),
  end_time: z.string(),
});

const applyInput = z.object({
  week_start: iso,
  mode: z.enum(["week", "month"]).default("week"),
  replace: z.boolean().default(false),
  rows: z.array(planRow),
});

/** Grava um plano já revisado/ajustado manualmente pelo gestor. */
export const applyWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const days = periodDays(data.week_start, data.mode);
    const start = days[0];
    const end = addDays(days[days.length - 1], 1);

    const { snapshotWeek } = await import("@/lib/snapshots.server");
    for (const w of weekStarts(days)) {
      await snapshotWeek(sb, context.userId, w, data.replace ? "Antes de regerar" : "Antes de completar");
    }

    if (data.replace) {
      const { error } = await sb.from("shifts").delete().gte("shift_date", start).lt("shift_date", end);
      if (error) throw new Error(error.message);
    }

    if (data.rows.length) {
      const rows = data.rows.map((r) => ({ ...r, owner_id: context.userId }));
      const { error } = await sb.from("shifts").insert(rows);
      if (error) throw new Error(error.message);
    }

    await sb.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "week.autofilled",
      payload: { week: data.week_start, mode: data.mode, count: data.rows.length, manual_review: true },
    });

    return { inserted: data.rows.length };
  });
