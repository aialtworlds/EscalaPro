import type { Violation } from "@/lib/clt-rules";
import { worstLevel } from "@/lib/clt-rules";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";

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

export function CltPanel({ violations }: { violations: Violation[] }) {
  if (!violations.length) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-success" /> Nenhuma inconsistência trabalhista.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {violations.map((v) => (
        <li
          key={v.code}
          className={`flex gap-1.5 text-[11px] leading-snug rounded-md border p-2 ${
            v.level === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : v.level === "warn"
                ? "border-warning/40 bg-warning/5"
                : "border-border bg-secondary/50 text-muted-foreground"
          }`}
        >
          {v.level === "info" ? <Info className="size-3.5 shrink-0 mt-px" /> : <AlertTriangle className="size-3.5 shrink-0 mt-px" />}
          <span>{v.message}</span>
        </li>
      ))}
    </ul>
  );
}
