import { useState } from "react";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { CltBadge, CltPanel } from "@/components/CltBadge";
import { ROLE_LABELS, trimTime } from "@/lib/date-utils";
import type { Violation } from "@/lib/clt-rules";
import type { DayShift } from "@/lib/types";

export function ShiftCard({
  shift, violations = [], configWarnings = [], onAbsent, onAdjust, onCover, onOverride,
}: {
  shift: DayShift;
  violations?: Violation[];
  configWarnings?: string[];
  onOverride?: (v: Violation) => void;
  onAbsent: () => void;
  onAdjust: () => void;
  onCover: () => void;
}) {
  const isAbsent = shift.status === "absent";
  const name = shift.employees?.name ?? shift.freelancer_label ?? "Freelancer";
  const role = shift.is_freelancer ? "Freelancer" : (shift.employees ? ROLE_LABELS[shift.employees.role_profile] ?? "" : "");
  const [showClt, setShowClt] = useState(false);
  return (
    <div
      className={`animate-fade-in bg-card border rounded-xl p-3 flex flex-col gap-3 shadow-sm ${
        isAbsent ? "border-destructive/40 bg-destructive/5" : "border-border"
      } ${shift.is_freelancer ? "border-dashed" : ""}`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-sm truncate">{name}</h3>
          <p className="text-[10px] text-muted-foreground uppercase font-medium">
            {role}
            {shift.sectors?.name && ` • ${shift.sectors.name}`}
          </p>
        </div>
        <span className="shrink-0 px-2 py-1 bg-secondary border border-border text-[10px] font-mono font-bold rounded">
          {trimTime(shift.start_time)} — {trimTime(shift.end_time)}
        </span>
      </div>

      {(violations.length > 0 || configWarnings.length > 0) && !isAbsent && (
        <div>
          <button onClick={() => setShowClt((v) => !v)} className="flex items-center gap-1.5">
            <CltBadge violations={violations} />
            <span className="text-[10px] text-muted-foreground">
              {violations.length} ponto{violations.length > 1 ? "s" : ""} — {showClt ? "ocultar" : "ver"}
            </span>
          </button>
          {showClt && (
            <div className="mt-2">
              <CltPanel violations={violations} configWarnings={configWarnings} onOverride={onOverride} />
            </div>
          )}
        </div>
      )}

      {isAbsent ? (
        <div className="flex flex-col gap-2 pt-1 border-t border-destructive/20">
          <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
            <AlertTriangle className="size-3.5" /> FALTA REGISTRADA
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCover}
              className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded active:scale-95 transition flex items-center justify-center gap-1"
            >
              <Sparkles className="size-3" /> Buscar cobertura
            </button>
            <button
              onClick={onAdjust}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider bg-secondary text-foreground rounded border border-border active:scale-95 transition"
            >
              Editar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 border-t border-border pt-3">
          <button
            onClick={onAbsent}
            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive rounded border border-destructive/20 active:scale-95 transition"
          >
            Registrar Falta
          </button>
          <button
            onClick={onAdjust}
            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider bg-secondary text-foreground rounded border border-border active:scale-95 transition"
          >
            <Clock className="size-3 inline mr-1" />
            Ajustar
          </button>
        </div>
      )}
    </div>
  );
}

export function SectorChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
        active
          ? "bg-foreground text-background"
          : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function Kpi({ label, value, accent }: { label: string; value: number; accent?: "destructive" | "warning" }) {
  const border =
    accent === "destructive" ? "border-l-4 border-l-destructive" : accent === "warning" ? "border-l-4 border-l-warning" : "";
  return (
    <div className={`flex-1 bg-card border border-border p-3 rounded-lg shadow-xs ${border}`}>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold">{String(value).padStart(2, "0")}</p>
    </div>
  );
}
