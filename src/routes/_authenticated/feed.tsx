import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Rocket, Bell, Info } from "lucide-react";
import { listSectors } from "@/lib/sectors.functions";
import { listEmployees } from "@/lib/employees.functions";
import { listShiftsByDay, listShiftsByWeek } from "@/lib/shifts.functions";
import { todayISO, formatDatePt, mondayOf } from "@/lib/date-utils";
import { computeAlerts } from "@/lib/alerts";
import { evaluateShift } from "@/lib/clt-rules";
import { toRuleEmployee } from "@/lib/clt/map";
import { listHolidays, listOverrides } from "@/lib/compliance.functions";
import type { Violation } from "@/lib/clt-rules";
import type { DayShift, EmployeeWithProfile, OverrideRow, SectorRow, ShiftPatch, WeekShift } from "@/lib/types";
import { CoverageSheet } from "@/components/CoverageSheet";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Kpi, SectorChip, ShiftCard } from "@/components/feed/ShiftCard";
import { FreelancerSheet } from "@/components/feed/FreelancerSheet";
import { EditShiftDialog } from "@/components/feed/EditShiftDialog";
import { AbsenceDialog } from "@/components/feed/AbsenceDialog";
import { OverrideDialog, type OverrideTarget } from "@/components/feed/OverrideDialog";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Feed Diário — EscalaPro OS" }, { name: "description", content: "Escala do dia com KPIs e ações rápidas." }] }),
  component: FeedPage,
});

function FeedPage() {
  const [date] = useState(todayISO());
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [freelancerOpen, setFreelancerOpen] = useState(false);
  const [adjustShift, setAdjustShift] = useState<DayShift | null>(null);
  const [absentShift, setAbsentShift] = useState<DayShift | null>(null);
  const [coverShift, setCoverShift] = useState<DayShift | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);

  const qc = useQueryClient();
  const sectorsFn = useServerFn(listSectors);
  const shiftsFn = useServerFn(listShiftsByDay);
  const weekFn = useServerFn(listShiftsByWeek);
  const empsFn = useServerFn(listEmployees);
  const holidaysFn = useServerFn(listHolidays);
  const overridesFn = useServerFn(listOverrides);

  const weekStart = mondayOf(date);
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() as Promise<SectorRow[]> });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() as Promise<EmployeeWithProfile[]> });
  const shifts = useQuery({
    queryKey: ["shifts", "day", date, sectorId],
    queryFn: () => shiftsFn({ data: { date, sector_id: sectorId } }) as Promise<DayShift[]>,
  });
  const weekShifts = useQuery({
    queryKey: ["shifts", "week", weekStart],
    queryFn: () => weekFn({ data: { week_start: weekStart } }) as Promise<WeekShift[]>,
  });
  const holidays = useQuery({ queryKey: ["holidays"], queryFn: () => holidaysFn() });

  const dayShifts = shifts.data ?? [];
  const dayIds = dayShifts.map((s) => s.id);
  const overrides = useQuery({
    queryKey: ["overrides", dayIds.join(",")],
    enabled: dayIds.length > 0,
    queryFn: () => overridesFn({ data: { shift_ids: dayIds } }) as Promise<OverrideRow[]>,
  });
  const overridesFor = (shiftId: string) =>
    Object.fromEntries(
      (overrides.data ?? []).filter((o) => o.shift_id === shiftId).map((o) => [o.rule_code, o.justification]),
    );

  const active = dayShifts.filter((s) => s.status === "scheduled").length;
  const absences = dayShifts.filter((s) => s.status === "absent").length;
  const extras = dayShifts.filter((s) => s.is_freelancer || s.is_extra).length;

  const isEmptyWorkspace =
    sectors.isSuccess && employees.isSuccess && !sectors.data?.length && !employees.data?.length;

  // Motor de conformidade: avalia cada turno do dia contra a semana inteira do
  // colaborador, com os parâmetros do perfil de jornada (regime/convenção),
  // os feriados cadastrados e as liberações já registradas.
  const complianceOf = (shift: DayShift, patch?: ShiftPatch) => {
    const emp = employees.data?.find((e) => e.id === shift.employee_id);
    if (!emp || !weekShifts.data) return { violations: [] as Violation[], configWarnings: [] as string[] };
    const others = weekShifts.data.filter((s) => s.id !== shift.id);
    const r = evaluateShift({ ...shift, ...patch }, toRuleEmployee(emp), others, {
      holidays: holidays.data ?? [],
      overrides: overridesFor(shift.id),
    });
    return { violations: r.violations, configWarnings: r.configWarnings };
  };

  const violationsById = new Map<string, Violation[]>();
  const warningsById = new Map<string, string[]>();
  for (const s of dayShifts) {
    if (s.status !== "absent") {
      const r = complianceOf(s);
      violationsById.set(s.id, r.violations);
      warningsById.set(s.id, r.configWarnings);
    }
  }
  const cltIssues = [...violationsById.values()].filter((v) => v.some((x) => x.level === "error")).length;

  const alerts =
    shifts.data && employees.data && sectors.data
      ? computeAlerts(
          dayShifts,
          sectorId ? employees.data.filter((e) => e.sector_id === sectorId) : employees.data,
          sectorId ? sectors.data.filter((s) => s.id === sectorId) : sectors.data,
        )
      : [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shifts"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  };

  return (
    <AppShell>
      {/* Sector chips */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-border bg-card">
        <SectorChip label="Todos" active={sectorId === null} onClick={() => setSectorId(null)} />
        {sectors.data?.map((s) => (
          <SectorChip key={s.id} label={s.name} active={sectorId === s.id} onClick={() => setSectorId(s.id)} />
        ))}
        {!sectors.data?.length && (
          <span className="text-xs text-muted-foreground self-center">Nenhum setor. Crie em Configurações.</span>
        )}
      </div>

      {/* Onboarding */}
      {isEmptyWorkspace && (
        <div className="mx-4 mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Rocket className="size-4 text-primary" /> Comece em 30 segundos
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie seus setores e os primeiros colaboradores para liberar o feed, a planilha semanal e o scanner.
          </p>
          <Button className="w-full mt-3 font-bold tracking-wide" onClick={() => setOnboardingOpen(true)}>
            CONFIGURAR OPERAÇÃO
          </Button>
        </div>
      )}

      {/* Date banner */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Escala do Dia</p>
        <h1 className="text-lg font-bold">{formatDatePt(date)}</h1>
      </div>

      {/* KPIs */}
      <div className="px-4 grid grid-cols-4 gap-2 mb-4">
        <Kpi label="Ativos" value={active} />
        <Kpi label="Faltas" value={absences} accent="destructive" />
        <Kpi label="Extras" value={extras} accent="warning" />
        <Kpi label="CLT" value={cltIssues} accent={cltIssues ? "destructive" : undefined} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setShowAlerts((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-warning/40 bg-warning/10"
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Bell className="size-3.5" /> {alerts.length} alerta{alerts.length > 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-muted-foreground">{showAlerts ? "ocultar" : "ver"}</span>
          </button>
          {showAlerts && (
            <div className="mt-2 space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-2.5 flex gap-2 ${
                    a.level === "critical"
                      ? "border-destructive/40 bg-destructive/5"
                      : a.level === "warning"
                        ? "border-warning/40 bg-warning/5"
                        : "border-border bg-card"
                  }`}
                >
                  {a.level === "info" ? (
                    <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <AlertTriangle className={`size-3.5 mt-0.5 shrink-0 ${a.level === "critical" ? "text-destructive" : "text-warning"}`} />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roster */}
      <div className="px-4 space-y-3">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Colaboradores</h2>
        {shifts.isLoading && <p className="text-xs text-muted-foreground py-4">Carregando...</p>}
        {shifts.data?.length === 0 && (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">Nenhum turno para hoje.</p>
            <p className="text-xs text-muted-foreground mt-1">Injete um freelancer ou escaneie uma escala.</p>
          </div>
        )}
        {dayShifts.map((s) => (
          <ShiftCard
            key={s.id}
            shift={s}
            violations={violationsById.get(s.id) ?? []}
            configWarnings={warningsById.get(s.id) ?? []}
            onOverride={(v) => setOverrideTarget({ shift: s, violation: v })}
            onAbsent={() => setAbsentShift(s)}
            onAdjust={() => setAdjustShift(s)}
            onCover={() => setCoverShift(s)}
          />
        ))}
      </div>

      {/* Floating action */}
      <button
        onClick={() => setFreelancerOpen(true)}
        className="fixed bottom-24 right-1/2 translate-x-[210px] max-[440px]:right-4 max-[440px]:translate-x-0 z-30 bg-primary text-primary-foreground py-3 pl-3 pr-4 rounded-full shadow-lg shadow-primary/30 border-2 border-background flex items-center gap-2 active:scale-95 transition"
      >
        <Plus className="size-5" strokeWidth={2.5} />
        <span className="text-xs font-bold uppercase tracking-tight">Freelancer</span>
      </button>

      <OnboardingWizard open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      <FreelancerSheet
        open={freelancerOpen}
        onOpenChange={setFreelancerOpen}
        date={date}
        sectorId={sectorId}
        sectors={sectors.data ?? []}
        onCreated={invalidate}
      />
      <CoverageSheet shift={coverShift} onOpenChange={(o) => !o && setCoverShift(null)} onAllocated={invalidate} />
      <EditShiftDialog
        shift={adjustShift}
        sectors={sectors.data ?? []}
        check={complianceOf}
        onOpenChange={(o) => !o && setAdjustShift(null)}
        onSaved={invalidate}
      />
      <OverrideDialog
        target={overrideTarget}
        onOpenChange={(o) => !o && setOverrideTarget(null)}
        onSaved={() => { setOverrideTarget(null); qc.invalidateQueries({ queryKey: ["overrides"] }); qc.invalidateQueries({ queryKey: ["activity"] }); }}
      />
      <AbsenceDialog
        shift={absentShift}
        onOpenChange={(o) => !o && setAbsentShift(null)}
        onSaved={invalidate}
      />
    </AppShell>
  );
}
