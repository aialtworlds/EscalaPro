import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const addDays = (i: string, days: number) => {
  const d = new Date(`${i}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const listSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ week_start: iso }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("schedule_snapshots")
      .select("id, week_start, label, created_at, payload")
      .eq("week_start", data.week_start)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      week_start: r.week_start,
      label: r.label,
      created_at: r.created_at,
      count: Array.isArray(r.payload) ? r.payload.length : 0,
    }));
  });

/** Cria um ponto de restauração manual da semana. */
export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ week_start: iso, label: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { snapshotWeek } = await import("@/lib/snapshots.server");
    const id = await snapshotWeek(
      context.supabase,
      context.userId,
      data.week_start,
      data.label ?? "Ponto manual",
    );
    if (!id) throw new Error("A semana está vazia — nada para salvar.");
    return { id };
  });

/** Volta a semana ao estado do snapshot. Antes disso, fotografa o estado atual. */
export const restoreSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: snap, error } = await context.supabase
      .from("schedule_snapshots")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { snapshotWeek } = await import("@/lib/snapshots.server");
    await snapshotWeek(context.supabase, context.userId, snap.week_start, "Antes de restaurar");

    const end = addDays(snap.week_start, 7);
    const { error: e1 } = await context.supabase
      .from("shifts")
      .delete()
      .gte("shift_date", snap.week_start)
      .lt("shift_date", end);
    if (e1) throw new Error(e1.message);

    const payload = Array.isArray(snap.payload) ? (snap.payload as Record<string, unknown>[]) : [];
    if (payload.length) {
      const rows = payload.map((p) => ({ ...p, owner_id: context.userId }));
      const { error: e2 } = await context.supabase.from("shifts").insert(rows as never);
      if (e2) throw new Error(e2.message);
    }

    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "week.restored",
      payload: { week: snap.week_start, count: payload.length },
    });
    return { restored: payload.length };
  });

export const deleteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedule_snapshots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
