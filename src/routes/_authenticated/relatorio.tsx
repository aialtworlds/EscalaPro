import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { monthlyReport } from "@/lib/report.functions";
import { fmtMinutes, monthLabel, shiftMonth } from "@/lib/report";
import { ROLE_LABELS, todayISO } from "@/lib/date-utils";
import { COMPLIANCE_DISCLAIMER } from "@/lib/clt-rules";
import { usePlan } from "@/hooks/usePlan";
import { UpgradeCard } from "@/components/billing/UpgradeCard";

export const Route = createFileRoute("/_authenticated/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório mensal — EscalaPro OS" },
      { name: "description", content: "Horas trabalhadas, extras, faltas e alertas de conformidade por colaborador no mês." },
      { property: "og:title", content: "Relatório mensal — EscalaPro OS" },
      { property: "og:description", content: "Fechamento mensal da escala: horas, extras, faltas e conformidade CLT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const plan = usePlan();
  const fn = useServerFn(monthlyReport);
  const q = useQuery({
    queryKey: ["report", month],
    queryFn: () => fn({ data: { month } }),
    enabled: plan.isPro,
  });

  const data = q.data;
  const rows = (data?.rows ?? []).filter((r) => r.shifts > 0 || r.absences > 0);


  function exportCsv() {
    if (!data) return;
    const head = ["Colaborador", "Perfil", "Setor", "Turnos", "Horas", "Extras", "Faltas", "Alertas"];
    const lines = rows.map((r) =>
      [r.name, ROLE_LABELS[r.role_profile] ?? r.role_profile, r.sector ?? "", r.shifts, fmtMinutes(r.minutes), fmtMinutes(r.extraMinutes), r.absences, r.violations.length].join(";"),
    );
    const blob = new Blob([[head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `escalapro-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Fechamento</p>
        <h1 className="text-lg font-bold">Relatório Mensal</h1>
      </div>

      <div className="px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="size-8" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-mono text-xs font-bold uppercase tracking-wider min-w-[130px] text-center">{monthLabel(month)}</span>
          <Button size="icon" variant="outline" className="size-8" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}>
          <Download className="size-3.5" /> CSV
        </Button>
      </div>

      {data && (
        <div className="px-4 mt-3 grid grid-cols-4 gap-2">
          {[
            { label: "Turnos", value: String(data.totals.shifts) },
            { label: "Horas", value: fmtMinutes(data.totals.minutes) },
            { label: "Extras", value: fmtMinutes(data.totals.extraMinutes) },
            { label: "Faltas", value: String(data.totals.absences) },
          ].map((k) => (
            <div key={k.label} className="bg-card border border-border rounded-lg p-2 text-center">
              <p className="font-mono text-sm font-bold">{k.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {data && data.totals.violations > 0 && (
        <div className="px-4 mt-2">
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <p className="text-xs">
              {data.totals.violations} alerta(s) de conformidade no mês · {data.totals.freelancerShifts} turno(s) de freelancer
            </p>
          </div>
        </div>
      )}

      <div className="px-4 mt-3 space-y-2">
        {q.isLoading && <p className="text-xs text-muted-foreground">Calculando...</p>}
        {q.error && <p className="text-xs text-destructive">Não foi possível montar o relatório.</p>}
        {!q.isLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Sem movimentação neste mês.</p>
        )}
        {rows.map((r) => (
          <div key={r.employee_id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{r.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABELS[r.role_profile] ?? r.role_profile} · {r.sector ?? "Sem setor"}
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-primary">{fmtMinutes(r.minutes)}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-[11px]">
              <Stat label="Turnos" value={String(r.shifts)} />
              <Stat label="Extras" value={fmtMinutes(r.extraMinutes)} />
              <Stat label="Faltas" value={String(r.absences)} />
              <Stat label="Alertas" value={String(r.violations.length)} tone={r.violations.length ? "bad" : undefined} />
            </div>
            {r.violations.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-border pt-2">
                {r.violations.slice(0, 5).map((v, i) => (
                  <li key={`${v.code}-${v.date}-${i}`} className="text-[11px] text-muted-foreground">
                    <span className="font-mono text-foreground">{v.date.slice(8)}/{v.date.slice(5, 7)}</span> — {v.message}
                  </li>
                ))}
                {r.violations.length > 5 && (
                  <li className="text-[11px] text-muted-foreground">+{r.violations.length - 5} outro(s)</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="px-4 mt-4 text-[10px] leading-relaxed text-muted-foreground">{COMPLIANCE_DISCLAIMER}</p>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-md border border-border px-2 py-1">
      <p className={tone === "bad" ? "text-destructive font-bold" : "font-bold"}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
