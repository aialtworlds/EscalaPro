// Leitura do plano do gestor + alternância de teste (enquanto a cobrança não está ativa).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadPlanState } = await import("@/lib/billing.server");
    return loadPlanState(context.supabase as never, context.userId);
  });

/**
 * Ativa/desativa o plano mensal em modo de teste.
 * Substituir por checkout + webhook quando a cobrança for ligada.
 */
export const setTestPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pro: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { planStateFromRow } = await import("@/lib/billing");

    const row = {
      owner_id: context.userId,
      plan: data.pro ? "pro" : "free",
      status: data.pro ? "trialing" : "none",
      provider: "test",
      current_period_end: data.pro
        ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        : null,
    };

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(row as never, { onConflict: "owner_id" });
    if (error) throw new Error(error.message);

    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "plan.test_changed",
      payload: { plan: row.plan },
    });

    return planStateFromRow(row as never);
  });
