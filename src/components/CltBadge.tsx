import type { Violation } from "@/lib/clt-rules";
import { COMPLIANCE_DISCLAIMER, worstLevel } from "@/lib/clt-rules";
import { AlertTriangle, Info, Lock, ShieldCheck, Unlock } from "lucide-react";

const SOURCE_LABEL: Record<Violation["source"], string> = {
  federal: "Federal",
  convencao: "Convenção",
  acordo: "Acordo",
};

export function CltBadge({ violations }: { violations: Violation[] }) {
  const level = worstLevel(violations);
  if (!level) return null;
  const style =
    level === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : level === "warn"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border bg-secondary text-muted-foreground";
  const Icon = level === "info" ? Info : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${style}`}>
      <Icon className="size-3" />
      {level === "error" ? "CLT" : level === "warn" ? "Atenção" : "Nota"}
    </span>
  );
}

export function CltPanel({
  violations,
  configWarnings = [],
  onOverride,
  showDisclaimer = true,
}: {
  violations: Violation[];
  configWarnings?: string[];
  /** Quando informado, alertas liberáveis ganham botão de liberação com justificativa. */
  onOverride?: (violation: Violation) => void;
  showDisclaimer?: boolean;
}) {
  const empty = !violations.length && !configWarnings.length;
  return (
    <div className="space-y-1.5">
      {configWarnings.map((w) => (
        <p key={w} className="flex gap-1.5 text-[11px] leading-snug rounded-md border border-warning/40 bg-warning/5 p-2">
          <Info className="size-3.5 shrink-0 mt-px" />
          <span>{w}</span>
        </p>
      ))}

      {empty && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" /> Nenhuma inconsistência trabalhista.
        </p>
      )}

      {violations.map((v) => (
        <div
          key={v.code}
          className={`rounded-md border p-2 text-[11px] leading-snug ${
            v.level === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : v.level === "warn"
                ? "border-warning/40 bg-warning/5"
                : "border-border bg-secondary/50 text-muted-foreground"
          }`}
        >
          <div className="flex gap-1.5">
            {v.level === "info" ? <Info className="size-3.5 shrink-0 mt-px" /> : <AlertTriangle className="size-3.5 shrink-0 mt-px" />}
            <span>{v.message}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5 pl-5">
            <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">
              {SOURCE_LABEL[v.source]} • {v.basis}
            </span>
            {onOverride &&
              (v.overridable ? (
                <button
                  onClick={() => onOverride(v)}
                  className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-background active:scale-95 transition"
                >
                  <Unlock className="size-2.5" /> Liberar
                </button>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider opacity-60">
                  <Lock className="size-2.5" /> Não liberável
                </span>
              ))}
          </div>
        </div>
      ))}

      {showDisclaimer && <p className="text-[9px] leading-snug text-muted-foreground/70 pt-0.5">{COMPLIANCE_DISCLAIMER}</p>}
    </div>
  );
}
