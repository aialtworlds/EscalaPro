// Painel de plano nas Configurações (modelo pronto, cobrança ainda desligada).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/hooks/usePlan";
import { setTestPlan } from "@/lib/billing.functions";
import { FREE_FEATURES, PLAN_LABELS, PRO_FEATURES, PRO_PRICE_LABEL } from "@/lib/billing";

export function PlanSettings() {
  const plan = usePlan();
  const qc = useQueryClient();
  const fn = useServerFn(setTestPlan);
  const m = useMutation({
    mutationFn: (pro: boolean) => fn({ data: { pro } }),
    onSuccess: (_r, pro) => {
      toast.success(pro ? "Plano mensal ativado (teste)" : "Voltou para o Free");
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["report"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <section className="px-4 mt-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Plano</p>

      <div className="mt-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Crown className={`size-4 shrink-0 ${plan.isPro ? "text-primary" : "text-muted-foreground"}`} />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{PLAN_LABELS[plan.plan]}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {plan.isPro
                  ? plan.provider === "test"
                    ? "Ativo em modo de teste"
                    : "Assinatura ativa"
                  : "Escalas semanais liberadas"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled className="text-xs shrink-0">
            {PRO_PRICE_LABEL}
          </Button>
        </div>

        <div className="mt-3 grid gap-3 border-t border-border pt-3">
          <PlanList title="Free (semanal)" items={FREE_FEATURES} />
          <PlanList title="Mensal (pago)" items={PRO_FEATURES} highlight />
        </div>

        <label className="mt-3 flex items-start justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs leading-snug">
            Simular plano mensal
            <span className="block text-muted-foreground">
              Cobrança ainda não está ativa. Use isto para testar os recursos mensais.
            </span>
          </span>
          <Switch
            checked={plan.isPro}
            disabled={m.isPending || plan.isLoading}
            onCheckedChange={(v) => m.mutate(v)}
            aria-label="Simular plano mensal"
          />
        </label>
      </div>
    </section>
  );
}

function PlanList({ title, items, highlight }: { title: string; items: string[]; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs">
            <Check className={`size-3.5 shrink-0 mt-0.5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
