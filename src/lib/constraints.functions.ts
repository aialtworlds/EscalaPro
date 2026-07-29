import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listConstraints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employee_constraints")
      .select("*, employees(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createConstraint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        kind: z.enum(["indisponivel_semanal", "afastamento"]),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        start_date: iso.nullable().optional(),
        end_date: iso.nullable().optional(),
        start_time: time.nullable().optional(),
        end_time: time.nullable().optional(),
        note: z.string().max(160).nullable().optional(),
      })
      .superRefine((v, ctx) => {
        if (v.kind === "indisponivel_semanal" && v.weekday == null)
          ctx.addIssue({ code: "custom", message: "Escolha o dia da semana." });
        if (v.kind === "afastamento" && (!v.start_date || !v.end_date))
          ctx.addIssue({ code: "custom", message: "Informe o período do afastamento." });
        if (v.start_date && v.end_date && v.end_date < v.start_date)
          ctx.addIssue({ code: "custom", message: "A data final é anterior à inicial." });
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      employee_id: data.employee_id,
      kind: data.kind,
      weekday: data.kind === "indisponivel_semanal" ? (data.weekday ?? null) : null,
      start_date: data.kind === "afastamento" ? (data.start_date ?? null) : null,
      end_date: data.kind === "afastamento" ? (data.end_date ?? null) : null,
      start_time: data.kind === "indisponivel_semanal" ? (data.start_time ?? null) : null,
      end_time: data.kind === "indisponivel_semanal" ? (data.end_time ?? null) : null,
      note: data.note ?? null,
    };
    const { data: created, error } = await context.supabase
      .from("employee_constraints")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "constraint.created",
      payload: { employee_id: data.employee_id, kind: data.kind },
    });
    return created;
  });

export const deleteConstraint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("employee_constraints").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateConstraint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["indisponivel_semanal", "afastamento"]),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        start_date: iso.nullable().optional(),
        end_date: iso.nullable().optional(),
        start_time: time.nullable().optional(),
        end_time: time.nullable().optional(),
        note: z.string().max(160).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      kind: data.kind,
      weekday: data.kind === "indisponivel_semanal" ? (data.weekday ?? null) : null,
      start_date: data.kind === "afastamento" ? (data.start_date ?? null) : null,
      end_date: data.kind === "afastamento" ? (data.end_date ?? null) : null,
      start_time: data.kind === "indisponivel_semanal" ? (data.start_time ?? null) : null,
      end_time: data.kind === "indisponivel_semanal" ? (data.end_time ?? null) : null,
      note: data.note ?? null,
    };
    const { data: row, error } = await context.supabase
      .from("employee_constraints")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
