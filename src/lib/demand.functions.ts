import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

export const listDemands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("demand_templates")
      .select("*, sectors(name)")
      .order("weekday")
      .order("start_time");
    if (error) throw new Error(error.message);
    return data;
  });

export const createDemand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sector_id: z.string().uuid().nullable(),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1),
        start_time: time,
        end_time: time,
        headcount: z.number().int().min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.weekdays.map((weekday) => ({
      owner_id: context.userId,
      sector_id: data.sector_id,
      weekday,
      start_time: data.start_time,
      end_time: data.end_time,
      headcount: data.headcount,
    }));
    const { error } = await context.supabase.from("demand_templates").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const deleteDemand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("demand_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
