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
