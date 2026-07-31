import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWeekPlan } from "@/lib/autofill";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
    if (data.mode === "month") {
      const { requirePro } = await import("@/lib/billing.server");
      await requirePro(sb as never, context.userId, "month_autofill");
    }
    const { periodDays, weekStarts, loadPlanInputs } = await import("@/lib/autofill.server");
    const days = periodDays(data.week_start, data.mode);
    const { demands, employees, constraints, existing, start, end } = await loadPlanInputs(
      sb,
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

const applyInput = z.object({
  week_start: iso,
  mode: z.enum(["week", "month"]).default("week"),
  replace: z.boolean().default(false),
  rows: z.array(
    z.object({
      employee_id: z.string().uuid(),
      sector_id: z.string().uuid().nullable().default(null),
      shift_date: iso,
      start_time: z.string(),
      end_time: z.string(),
    }),
  ),
});

/** Grava um plano já revisado/ajustado manualmente pelo gestor. */
export const applyWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.mode === "month") {
      const { requirePro } = await import("@/lib/billing.server");
      await requirePro(sb as never, context.userId, "month_autofill");
    }
    const { periodDays, weekStarts, addDays } = await import("@/lib/autofill.server");
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
