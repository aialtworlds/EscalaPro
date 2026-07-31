// Aviso de recurso pago (modelo de plano — cobrança ainda não ativa).
import { Lock, Check } from "lucide-react";
import { PRO_FEATURES, PRO_FEATURE_COPY, PRO_PRICE_LABEL, type ProFeature } from "@/lib/billing";

export function UpgradeCard({ feature, compact }: { feature: ProFeature; compact?: boolean }) {
  const copy = PRO_FEATURE_COPY[feature];
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Lock className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{copy.title}</p>
          <p className="mt-1 text-xs text-muted-foreground leading-snug">{copy.body}</p>
        </div>
      </div>

      {!compact && (
        <ul className="mt-3 space-y-1">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs">
              <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Plano mensal · {PRO_PRICE_LABEL} · assinatura em breve
      </p>
    </div>
  );
}
