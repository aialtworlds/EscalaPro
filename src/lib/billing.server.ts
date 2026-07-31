// Helpers de servidor do modelo de planos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { planStateFromRow, PRO_REQUIRED_ERROR, type PlanState, type ProFeature } from "@/lib/billing";

type Sb = SupabaseClient<never, never, never>;

export async function loadPlanState(sb: Sb, userId: string): Promise<PlanState> {
  const { data } = await (sb as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  })
    .from("subscriptions")
    .select("plan, status, provider, current_period_end")
    .eq("owner_id", userId)
    .maybeSingle();

  return planStateFromRow(data as never);
}

/** Trava de servidor: recursos mensais exigem plano mensal ativo. */
export async function requirePro(sb: Sb, userId: string, _feature: ProFeature) {
  const state = await loadPlanState(sb, userId);
  if (!state.isPro) throw new Error(PRO_REQUIRED_ERROR);
  return state;
}
