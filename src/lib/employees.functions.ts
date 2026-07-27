import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleProfile = z.enum(["clt_regular", "estagiario", "clt_mulher"]);

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employees")
      .select("*, sectors(name), compliance_profiles(*, agreements(*))")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(80),
      role_profile: roleProfile,
      entry_time: z.string().regex(/^\d{2}:\d{2}$/),
      journey_hours: z.number().min(1).max(12),
      sector_id: z.string().uuid().nullable(),
      compliance_profile_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("employees")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "employee.created",
      payload: { name: data.name },
    });
    return row;
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("employees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
