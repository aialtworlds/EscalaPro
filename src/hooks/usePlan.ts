import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlan } from "@/lib/billing.functions";
import { FREE_STATE, type PlanState } from "@/lib/billing";

/** Plano atual do gestor (free = semanal, pro = mensal). */
export function usePlan() {
  const fn = useServerFn(getMyPlan);
  const q = useQuery({ queryKey: ["plan"], queryFn: () => fn(), staleTime: 60_000 });
  const state: PlanState = (q.data as PlanState | undefined) ?? FREE_STATE;
  return { ...state, isLoading: q.isLoading };
}
