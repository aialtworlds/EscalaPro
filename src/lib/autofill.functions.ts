import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWeekPlan, type AutoConstraint, type AutoDemand, type AutoEmployee } from "@/lib/autofill";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const addDays = (i: string, days: number) => {
  const d = new Date(`${i}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const input = z.object({
  week_start: iso,
  /** true = limpa a semana antes (mantendo um snapshot), false = só completa lacunas. */
  replace: z.boolean().default(false),
  /** Prévia: calcula e devolve o plano sem gravar nada. */
  preview: z.boolean().default(false),
});

export const autofillWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const end = addDays(data.week_start, 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(data.week_start, i));

    const [demandsRes, empsRes, consRes] = await Promise.all([
      sb.from("demand_templates").select("*"),
      sb.from("employees").select("id, name, sector_id, role_profile, journey_hours"),
      sb.from("employee_constraints").select("*"),
    ]);
    if (demandsRes.error) throw new Error(demandsRes.error.message);
    if (empsRes.error) throw new Error(empsRes.error.message);
    if (consRes.error) throw new Error(consRes.error.message);

    const demands = (demandsRes.data ?? []) as unknown as AutoDemand[];
    if (!demands.length) throw new Error("Cadastre a demanda por setor antes de gerar a escala.");
    const employees = (empsRes.data ?? []).map((e) => ({
      ...e,
      journey_hours: Number(e.journey_hours),
    })) as AutoEmployee[];
    if (!employees.length) throw new Error("Nenhum colaborador cadastrado.");
    const constraints = (consRes.data ?? []) as unknown as AutoConstraint[];

    // Em modo "substituir", a semana é considerada vazia para o planejamento.
    let existing: { employee_id: string | null; shift_date: string; start_time: string; end_time: string }[] = [];
    if (!data.replace) {
      const { data: rows, error } = await sb
        .from("shifts")
        .select("employee_id, shift_date, start_time, end_time")
        .gte("shift_date", data.week_start)
        .lt("shift_date", end);
      if (error) throw new Error(error.message);
      existing = rows ?? [];
    }

    const plan = buildWeekPlan({ days, demands, employees, constraints, existing });

    if (data.preview) {
      const byId = new Map(employees.map((e) => [e.id, e.name]));
      return {
        preview: true as const,
        inserted: 0,
        planned: plan.planned.map((p) => ({ ...p, employee_name: byId.get(p.employee_id) ?? "" })),
        gaps: plan.gaps,
      };
    }

    const { snapshotWeek } = await import("@/lib/snapshots.server");
    await snapshotWeek(sb, context.userId, data.week_start, data.replace ? "Antes de regerar" : "Antes de completar");

    if (data.replace) {
      const { error } = await sb
        .from("shifts")
        .delete()
        .gte("shift_date", data.week_start)
        .lt("shift_date", end);
      if (error) throw new Error(error.message);
    }

    if (plan.planned.length) {
      const rows = plan.planned.map((p) => ({ ...p, owner_id: context.userId }));
      const { error } = await sb.from("shifts").insert(rows);
      if (error) throw new Error(error.message);
    }

    await sb.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "week.autofilled",
      payload: { week: data.week_start, count: plan.planned.length, gaps: plan.gaps.length },
    });

    const byId = new Map(employees.map((e) => [e.id, e.name]));
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
  replace: z.boolean().default(false),
  rows: z.array(planRow),
});

/** Grava um plano já revisado/ajustado manualmente pelo gestor. */
export const applyWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const end = addDays(data.week_start, 7);

    const { snapshotWeek } = await import("@/lib/snapshots.server");
    await snapshotWeek(sb, context.userId, data.week_start, data.replace ? "Antes de regerar" : "Antes de completar");

    if (data.replace) {
      const { error } = await sb
        .from("shifts")
        .delete()
        .gte("shift_date", data.week_start)
        .lt("shift_date", end);
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
      payload: { week: data.week_start, count: data.rows.length, manual_review: true },
    });

    return { inserted: data.rows.length };
  });
