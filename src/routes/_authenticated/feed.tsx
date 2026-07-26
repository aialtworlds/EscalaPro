import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, Clock, Trash2, RotateCcw, Rocket, Bell, Info, Sparkles } from "lucide-react";
import { listSectors } from "@/lib/sectors.functions";
import { listEmployees } from "@/lib/employees.functions";
import { listShiftsByDay, listShiftsByWeek, createShift, updateShift, markShiftAbsent, deleteShift, clearAbsence } from "@/lib/shifts.functions";
import { todayISO, trimTime, formatDatePt, ROLE_LABELS, mondayOf } from "@/lib/date-utils";
import { computeAlerts } from "@/lib/alerts";
import { checkShiftCompliance } from "@/lib/clt-rules";
import type { Violation } from "@/lib/clt-rules";
import { CltBadge, CltPanel } from "@/components/CltBadge";
import { CoverageSheet } from "@/components/CoverageSheet";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Feed Diário — EscalaPro OS" }, { name: "description", content: "Escala do dia com KPIs e ações rápidas." }] }),
  component: FeedPage,
});

const SHIFT_PRESETS = [
  { label: "Manhã", start: "08:00", end: "16:00" },
  { label: "Tarde", start: "14:00", end: "22:00" },
  { label: "Noite", start: "18:00", end: "02:00" },
] as const;

function FeedPage() {
  const [date] = useState(todayISO());
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [freelancerOpen, setFreelancerOpen] = useState(false);
  const [adjustShift, setAdjustShift] = useState<any | null>(null);
  const [absentShift, setAbsentShift] = useState<any | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);

  const qc = useQueryClient();
  const sectorsFn = useServerFn(listSectors);
  const shiftsFn = useServerFn(listShiftsByDay);
  const empsFn = useServerFn(listEmployees);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });
  const shifts = useQuery({
    queryKey: ["shifts", "day", date, sectorId],
    queryFn: () => shiftsFn({ data: { date, sector_id: sectorId } }),
  });

  const active = shifts.data?.filter((s) => s.status === "scheduled").length ?? 0;
  const absences = shifts.data?.filter((s) => s.status === "absent").length ?? 0;
  const extras = shifts.data?.filter((s) => s.is_freelancer || s.is_extra).length ?? 0;

  const isEmptyWorkspace =
    sectors.isSuccess && employees.isSuccess && !sectors.data?.length && !employees.data?.length;

  const alerts =
    shifts.data && employees.data && sectors.data
      ? computeAlerts(
          shifts.data as any,
          (sectorId ? employees.data.filter((e) => e.sector_id === sectorId) : employees.data) as any,
          (sectorId ? sectors.data.filter((s) => s.id === sectorId) : sectors.data) as any,
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
      <div className="px-4 flex gap-2 mb-4">
        <Kpi label="Ativos" value={active} />
        <Kpi label="Faltas" value={absences} accent="destructive" />
        <Kpi label="Extras" value={extras} accent="warning" />
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
        {shifts.data?.map((s) => (
          <ShiftCard
            key={s.id}
            shift={s}
            onAbsent={() => setAbsentShift(s)}
            onAdjust={() => setAdjustShift(s)}
            onChanged={invalidate}
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
      <EditShiftDialog
        shift={adjustShift}
        sectors={sectors.data ?? []}
        onOpenChange={(o) => !o && setAdjustShift(null)}
        onSaved={invalidate}
      />
      <AbsenceDialog
        shift={absentShift}
        onOpenChange={(o) => !o && setAbsentShift(null)}
        onSaved={invalidate}
      />
    </AppShell>
  );
}


function SectorChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function Kpi({ label, value, accent }: { label: string; value: number; accent?: "destructive" | "warning" }) {
  const border =
    accent === "destructive" ? "border-l-4 border-l-destructive" : accent === "warning" ? "border-l-4 border-l-warning" : "";
  return (
    <div className={`flex-1 bg-card border border-border p-3 rounded-lg shadow-xs ${border}`}>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold">{String(value).padStart(2, "0")}</p>
    </div>
  );
}

function ShiftCard({ shift, onAbsent, onAdjust }: { shift: any; onAbsent: () => void; onAdjust: () => void; onChanged?: () => void }) {
  const isAbsent = shift.status === "absent";
  const name = shift.employees?.name ?? shift.freelancer_label ?? "Freelancer";
  const role = shift.is_freelancer ? "Freelancer" : ROLE_LABELS[shift.employees?.role_profile] ?? "";
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
      {isAbsent ? (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-destructive/20">
          <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
            <AlertTriangle className="size-3.5" /> FALTA REGISTRADA
          </span>
          <button
            onClick={onAdjust}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-secondary text-foreground rounded border border-border active:scale-95 transition"
          >
            Editar
          </button>
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

function FreelancerSheet({
  open, onOpenChange, date, sectorId, sectors, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  sectorId: string | null;
  sectors: any[];
  onCreated: () => void;
}) {
  const [preset, setPreset] = useState<number>(0);
  const [customStart, setCustomStart] = useState("08:00");
  const [customEnd, setCustomEnd] = useState("16:00");
  const [label, setLabel] = useState("");
  const [pickedSector, setPickedSector] = useState<string | null>(sectorId);
  const createFn = useServerFn(createShift);
  const m = useMutation({
    mutationFn: (v: { start: string; end: string }) =>
      createFn({
        data: {
          employee_id: null,
          sector_id: pickedSector,
          shift_date: date,
          start_time: v.start,
          end_time: v.end,
          is_freelancer: true,
          freelancer_label: label || null,
          is_extra: true,
        },
      }),
    onSuccess: () => {
      toast.success("Freelancer alocado");
      onCreated();
      onOpenChange(false);
      setLabel("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const isCustom = preset === 3;
  const start = isCustom ? customStart : SHIFT_PRESETS[preset].start;
  const end = isCustom ? customEnd : SHIFT_PRESETS[preset].end;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-[440px] mx-auto">
        <SheetHeader>
          <SheetTitle>Injetar Freelancer</SheetTitle>
          <SheetDescription>Selecione o turno para cobertura imediata.</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {SHIFT_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={`p-4 border rounded-xl text-left transition ${
                preset === i ? "bg-primary/5 border-primary ring-2 ring-primary" : "border-border bg-card"
              }`}
            >
              <p className={`text-[10px] font-bold uppercase ${preset === i ? "text-primary" : "text-muted-foreground"}`}>{p.label}</p>
              <p className="font-mono text-sm font-bold mt-1">{p.start} — {p.end}</p>
            </button>
          ))}
          <button
            onClick={() => setPreset(3)}
            className={`p-4 border rounded-xl text-left transition border-dashed ${
              isCustom ? "bg-primary/5 border-primary ring-2 ring-primary" : "border-border"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase ${isCustom ? "text-primary" : "text-muted-foreground"}`}>Custom</p>
            <p className="font-mono text-sm font-bold mt-1">Definir</p>
          </button>
        </div>

        {isCustom && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="font-mono" />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={pickedSector ?? ""} onValueChange={(v) => setPickedSector(v || null)}>
              <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rótulo (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: João Freelancer" />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            className="w-full font-bold tracking-wide"
            disabled={m.isPending}
            onClick={() => m.mutate({ start, end })}
          >
            {m.isPending ? "Alocando..." : "CONFIRMAR ALOCAÇÃO"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EditShiftDialog({
  shift, sectors, onOpenChange, onSaved,
}: {
  shift: any | null;
  sectors: any[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [sector, setSector] = useState<string>("");
  const [label, setLabel] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateFn = useServerFn(updateShift);
  const deleteFn = useServerFn(deleteShift);
  const clearFn = useServerFn(clearAbsence);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: shift.id,
          start_time: start,
          end_time: end,
          sector_id: sector || null,
          freelancer_label: shift.is_freelancer ? label || null : undefined,
        },
      }),
    onSuccess: () => { toast.success("Turno atualizado"); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: shift.id } }),
    onSuccess: () => { toast.success("Turno excluído"); onSaved(); onOpenChange(false); setConfirmDelete(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const revert = useMutation({
    mutationFn: () => clearFn({ data: { id: shift.id } }),
    onSuccess: () => { toast.success("Falta desfeita"); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <Dialog
      open={!!shift}
      onOpenChange={(o: boolean) => {
        if (!o) { onOpenChange(false); setConfirmDelete(false); }
        else if (shift) {
          setStart(trimTime(shift.start_time));
          setEnd(trimTime(shift.end_time));
          setSector(shift.sector_id ?? "");
          setLabel(shift.freelancer_label ?? "");
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Turno</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Entrada</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Saída</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {shift?.is_freelancer && (
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: João Freelancer" />
            </div>
          )}
          {shift?.status === "absent" && (
            <Button variant="outline" className="w-full" disabled={revert.isPending} onClick={() => revert.mutate()}>
              <RotateCcw className="size-4 mr-1" /> Desfazer falta
            </Button>
          )}
          {confirmDelete ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs">Excluir este turno permanentemente?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                <Button variant="destructive" className="flex-1" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center justify-center gap-1"
            >
              <Trash2 className="size-3.5" /> Excluir turno
            </button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AbsenceDialog({ shift, onOpenChange, onSaved }: { shift: any | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const fn = useServerFn(markShiftAbsent);
  const m = useMutation({
    mutationFn: () => fn({ data: { id: shift.id, reason: reason || undefined } }),
    onSuccess: () => { toast.success("Falta registrada"); onSaved(); onOpenChange(false); setReason(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Falta</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {shift?.employees?.name ?? "Freelancer"} — {shift && formatDatePt(shift.shift_date)}
          </p>
          <Label className="text-xs">Motivo (opcional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Atestado" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            Registrar Falta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
