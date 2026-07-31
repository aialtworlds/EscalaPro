import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const listShiftsByDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sector_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("shifts")
      .select("*, employees(name, role_profile), sectors(name)")
      .eq("shift_date", data.date)
      .order("start_time");
    if (data.sector_id) q = q.eq("sector_id", data.sector_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });

export const listShiftsByWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const start = new Date(data.week_start);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("shifts")
      .select("*, employees(name), sectors(name)")
      .gte("shift_date", data.week_start)
      .lt("shift_date", endStr)
      .order("shift_date");
    if (error) throw new Error(error.message);
    return rows;
  });

export const createShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employee_id: z.string().uuid().nullable(),
      sector_id: z.string().uuid().nullable(),
      shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      start_time: z.string().regex(timeRegex),
      end_time: z.string().regex(timeRegex),
      is_freelancer: z.boolean().default(false),
      freelancer_label: z.string().nullable().optional(),
      is_extra: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("shifts")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: data.is_freelancer ? "shift.freelancer_injected" : "shift.created",
      payload: { shift_id: row.id, date: data.shift_date },
    });
    return row;
  });

export const updateShiftBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      start_time: z.string().regex(timeRegex),
      end_time: z.string().regex(timeRegex),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("shifts")
      .update({ start_time: data.start_time, end_time: data.end_time })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "shift.block_adjusted",
      payload: { shift_id: data.id, start: data.start_time, end: data.end_time },
    });
    return row;
  });

export const markShiftAbsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(240).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: shift, error: e1 } = await context.supabase
      .from("shifts")
      .update({ status: "absent" })
      .eq("id", data.id)
      .select()
      .single();
    if (e1) throw new Error(e1.message);
    if (shift?.employee_id) {
      await context.supabase.from("absences").insert({
        owner_id: context.userId,
        employee_id: shift.employee_id,
        absence_date: shift.shift_date,
        reason: data.reason ?? null,
      });
    }
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "shift.absent_registered",
      payload: { shift_id: data.id, reason: data.reason ?? null },
    });
    return shift;
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Full edit of a shift (times, sector, label, extra flag).
export const updateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      start_time: z.string().regex(timeRegex),
      end_time: z.string().regex(timeRegex),
      sector_id: z.string().uuid().nullable(),
      freelancer_label: z.string().max(80).nullable().optional(),
      is_extra: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("shifts")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "shift.updated",
      payload: { shift_id: id, start: patch.start_time, end: patch.end_time },
    });
    return row;
  });

// Move a shift to another employee and/or day (drag & drop on the matrix).
export const moveShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      employee_id: z.string().uuid().nullable(),
      shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      swap_with: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.swap_with) {
      const { data: other, error: e0 } = await context.supabase
        .from("shifts")
        .select("id, employee_id, shift_date")
        .eq("id", data.swap_with)
        .single();
      if (e0) throw new Error(e0.message);
      const { data: src, error: e1 } = await context.supabase
        .from("shifts")
        .select("id, employee_id, shift_date")
        .eq("id", data.id)
        .single();
      if (e1) throw new Error(e1.message);
      // Park the source row on a temporary date to dodge unique collisions.
      await context.supabase
        .from("shifts")
        .update({ employee_id: null, shift_date: src.shift_date })
        .eq("id", src.id);
      const { error: e2 } = await context.supabase
        .from("shifts")
        .update({ employee_id: src.employee_id, shift_date: src.shift_date })
        .eq("id", other.id);
      if (e2) throw new Error(e2.message);
      const { error: e3 } = await context.supabase
        .from("shifts")
        .update({ employee_id: other.employee_id, shift_date: other.shift_date })
        .eq("id", src.id);
      if (e3) throw new Error(e3.message);
      await context.supabase.from("activity_log").insert({
        owner_id: context.userId,
        event_type: "shift.swapped",
        payload: { a: src.id, b: other.id },
      });
      return { ok: true, swapped: true };
    }

    const { data: row, error } = await context.supabase
      .from("shifts")
      .update({ employee_id: data.employee_id, shift_date: data.shift_date })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "shift.moved",
      payload: { shift_id: data.id, employee_id: data.employee_id, shift_date: data.shift_date },
    });
    return { ok: true, swapped: false, shift: row };
  });

// Revert an absence back to scheduled and remove the absence record.
export const clearAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: shift, error } = await context.supabase
      .from("shifts")
      .update({ status: "scheduled" })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (shift?.employee_id) {
      await context.supabase
        .from("absences")
        .delete()
        .eq("employee_id", shift.employee_id)
        .eq("absence_date", shift.shift_date);
    }
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "shift.absence_cleared",
      payload: { shift_id: data.id },
    });
    return shift;
  });

// Copy a whole week of shifts into another week.
export const duplicateWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      from_week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      include_freelancers: z.boolean().default(false),
      overwrite: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const shiftISO = (iso: string, days: number) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const fromEnd = shiftISO(data.from_week, 7);
    const toEnd = shiftISO(data.to_week, 7);

    const { data: source, error: e1 } = await context.supabase
      .from("shifts")
      .select("*")
      .gte("shift_date", data.from_week)
      .lt("shift_date", fromEnd);
    if (e1) throw new Error(e1.message);
    if (!source?.length) throw new Error("A semana de origem está vazia.");

    const { data: target, error: e2 } = await context.supabase
      .from("shifts")
      .select("id")
      .gte("shift_date", data.to_week)
      .lt("shift_date", toEnd);
    if (e2) throw new Error(e2.message);

    if (target?.length) {
      if (!data.overwrite) throw new Error("A semana de destino já tem turnos. Marque 'substituir' para sobrescrever.");
      // Ponto de restauração antes de apagar a semana de destino.
      const { snapshotWeek } = await import("@/lib/snapshots.server");
      await snapshotWeek(context.supabase, context.userId, data.to_week, "Antes de duplicar");
      const { error: e3 } = await context.supabase
        .from("shifts")
        .delete()
        .gte("shift_date", data.to_week)
        .lt("shift_date", toEnd);
      if (e3) throw new Error(e3.message);
    }

    const dayDiff = Math.round(
      (Date.parse(`${data.to_week}T00:00:00Z`) - Date.parse(`${data.from_week}T00:00:00Z`)) / 86400000,
    );
    const rows = source
      .filter((s) => (data.include_freelancers ? true : !s.is_freelancer))
      .map((s) => ({
        owner_id: context.userId,
        employee_id: s.employee_id,
        sector_id: s.sector_id,
        shift_date: shiftISO(s.shift_date, dayDiff),
        start_time: s.start_time,
        end_time: s.end_time,
        is_freelancer: s.is_freelancer,
        freelancer_label: s.freelancer_label,
        is_extra: s.is_extra,
        status: "scheduled" as const,
      }));
    if (!rows.length) return { inserted: 0 };
    const { error: e4 } = await context.supabase.from("shifts").insert(rows);
    if (e4) throw new Error(e4.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "week.duplicated",
      payload: { from: data.from_week, to: data.to_week, count: rows.length },
    });
    return { inserted: rows.length };
  });
