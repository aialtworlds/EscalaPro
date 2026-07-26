import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const STARTER_SECTORS = ["Salão", "Cozinha", "Caixa"] as const;

const seedSchema = z.object({
  sectors: z.array(z.string().min(1).max(60)).min(1).max(12),
  employees: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        sector_index: z.number().int().min(0),
        entry_time: z.string().regex(/^\d{2}:\d{2}$/),
        journey_hours: z.number().min(1).max(12),
      }),
    )
    .max(40),
});

/** One-shot workspace bootstrap: creates sectors and (optionally) the first employees. */
export const seedWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => seedSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: sectorRows, error: e1 } = await context.supabase
      .from("sectors")
      .insert(data.sectors.map((name) => ({ owner_id: context.userId, name: name.trim() })))
      .select();
    if (e1) throw new Error(e1.message);

    let employeeCount = 0;
    if (data.employees.length) {
      const rows = data.employees.map((e) => ({
        owner_id: context.userId,
        name: e.name.trim(),
        sector_id: sectorRows?.[e.sector_index]?.id ?? null,
        entry_time: e.entry_time,
        journey_hours: e.journey_hours,
      }));
      const { error: e2 } = await context.supabase.from("employees").insert(rows);
      if (e2) throw new Error(e2.message);
      employeeCount = rows.length;
    }

    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "workspace.seeded",
      payload: { sectors: data.sectors.length, employees: employeeCount },
    });

    return { sectors: sectorRows?.length ?? 0, employees: employeeCount };
  });
