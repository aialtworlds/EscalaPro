import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { listShiftsByWeek, duplicateWeek } from "@/lib/shifts.functions";
import { listEmployees } from "@/lib/employees.functions";
import { mondayOf, addDays, todayISO, WEEKDAY_LABELS, trimTime } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, Copy, Download, Printer, Share2, History, Wand2 } from "lucide-react";
import { AutofillDialog } from "@/components/week/AutofillDialog";
import { ShareDialog } from "@/components/week/ShareDialog";
import { HistoryDialog } from "@/components/week/HistoryDialog";
import { MonthMatrix } from "@/components/week/MonthMatrix";
import { useShiftDrag } from "@/components/week/useShiftDrag";

export const Route = createFileRoute("/_authenticated/semana")({
  head: () => ({ meta: [{ title: "Planilha Semanal — EscalaPro OS" }, { name: "description", content: "Matriz semanal de escala." }] }),
  component: SemanaPage,
});

function SemanaPage() {
  const [view, setView] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [dupOpen, setDupOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const drag = useShiftDrag();
  const shiftsFn = useServerFn(listShiftsByWeek);
  const empsFn = useServerFn(listEmployees);
  const shifts = useQuery({ queryKey: ["shifts", "week", weekStart], queryFn: () => shiftsFn({ data: { week_start: weekStart } }) });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)} — ${days[6].slice(8, 10)}/${days[6].slice(5, 7)}`;

  function exportCsv() {
    const header = ["Colaborador", ...days.map((d, i) => `${WEEKDAY_LABELS[(i + 1) % 7]} ${d.slice(8, 10)}/${d.slice(5, 7)}`)];
    const rows = (employees.data ?? []).map((emp) => [
      emp.name,
      ...days.map((d) => {
        const s = shifts.data?.find((x) => x.employee_id === emp.id && x.shift_date === d);
        if (!s) return "";
        if (s.status === "absent") return "FALTA";
        return `${trimTime(s.start_time)}-${trimTime(s.end_time)}`;
      }),
    ]);
    const freelas = days.map((d) =>
      (shifts.data ?? [])
        .filter((x) => !x.employee_id && x.shift_date === d)
        .map((x) => `${x.freelancer_label ?? "Freelancer"} ${trimTime(x.start_time)}-${trimTime(x.end_time)}`)
        .join(" | "),
    );
    if (freelas.some(Boolean)) rows.push(["Freelancers", ...freelas]);

    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-${weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  return (
    <AppShell>
      <div className="px-4 pt-4 print:hidden">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Planilha</p>
        <div className="grid grid-cols-2 gap-1">
          {([["week", "Semana"], ["month", "Mês"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`py-2 rounded text-[11px] font-bold uppercase border transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <div className="pt-3">
          <MonthMatrix month={month} onMonthChange={setMonth} />
        </div>
      ) : (
        <>
      <div className="px-4 pt-4 pb-2 print:pt-0">

        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Planilha Semanal</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-lg font-bold font-mono">{weekLabel}</h1>
          <div className="flex gap-1 print:hidden">
            <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Próxima semana">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 print:hidden">
          <Button size="sm" className="w-full text-xs font-bold" onClick={() => setAutoOpen(true)}>
            <Wand2 className="size-3.5 mr-1.5" /> Gerar escala automática
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 print:hidden">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setDupOpen(true)}>
            <Copy className="size-3.5 mr-1" /> Duplicar
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setShareOpen(true)}>
            <Share2 className="size-3.5 mr-1" /> Enviar
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setHistOpen(true)}>
            <History className="size-3.5 mr-1" /> Histórico
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={exportCsv}>
            <Download className="size-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1" /> PDF
          </Button>
        </div>
      </div>




      <div className="px-4">
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th className="p-2 text-left border-r border-border sticky left-0 bg-secondary z-10 min-w-[100px]">Colab.</th>
                {days.map((d, i) => (
                  <th key={d} className="p-2 text-center border-r border-border last:border-r-0 min-w-[52px]">
                    <div className="font-bold">{WEEKDAY_LABELS[(i + 1) % 7]}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">{d.slice(8, 10)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.data?.map((emp) => (
                <tr key={emp.id} className="border-t border-border">
                  <td
                    onPointerDown={(e) => drag.startEmployeeDrag(e, emp.id, emp.name)}
                    className={`p-2 font-medium border-r border-border sticky left-0 bg-card z-10 truncate max-w-[100px] cursor-grab touch-none select-none ${
                      drag.dragEmployeeId === emp.id ? "text-primary" : ""
                    }`}
                    title="Arraste o nome para alocar em um dia"
                  >
                    {emp.name}
                  </td>
                  {days.map((d) => {
                    const s = shifts.data?.find((x) => x.employee_id === emp.id && x.shift_date === d);
                    const key = `${emp.id}|${d}`;
                    return (
                      <td
                        key={d}
                        data-cell={key}
                        data-shift-id={s?.id ?? ""}
                        className={`p-1 text-center border-r border-border last:border-r-0 ${
                          drag.hoverKey === key && drag.active ? "bg-primary/20 outline outline-1 outline-primary" : ""
                        }`}
                      >
                        {s ? (
                          <div
                            onPointerDown={(e) => drag.startDrag(e, s.id)}
                            className={`py-1 px-1 rounded text-[9px] font-mono font-bold cursor-grab touch-none select-none ${
                              drag.dragId === s.id ? "opacity-40" : ""
                            } ${
                              s.status === "absent" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
                            }`}
                          >
                            {trimTime(s.start_time).slice(0, 5)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {shifts.data?.filter((s) => !s.employee_id).length ? (
                <tr className="border-t border-border">
                  <td className="p-2 font-medium border-r border-border sticky left-0 bg-card z-10 text-muted-foreground italic">
                    Freelancers
                  </td>
                  {days.map((d) => {
                    const count = shifts.data?.filter((x) => !x.employee_id && x.shift_date === d).length ?? 0;
                    return (
                      <td
                        key={d}
                        data-cell={`freela|${d}`}
                        className={`p-1 text-center border-r border-border last:border-r-0 ${
                          drag.hoverKey === `freela|${d}` && drag.active
                            ? "bg-primary/20 outline outline-1 outline-primary"
                            : ""
                        }`}
                      >
                        {count > 0 ? (
                          <div className="py-1 rounded text-[9px] font-mono font-bold bg-warning/15 text-warning-foreground">
                            +{count}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!employees.data?.length && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhum colaborador cadastrado. Vá para Configurações.
          </p>
        )}
      </div>

      <div className="px-4 mt-6 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legenda</p>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="size-3 bg-primary/20 rounded" /> Turno</span>
          <span className="flex items-center gap-1"><span className="size-3 bg-destructive/20 rounded" /> Falta</span>
          <span className="flex items-center gap-1"><span className="size-3 bg-warning/20 rounded" /> Freelancer</span>
        </div>
        <p className="text-[10px] text-muted-foreground print:hidden">
          Arraste um turno para outro dia ou colaborador (soltar sobre um turno troca os dois). Arraste o
          <strong className="text-foreground"> nome do colaborador </strong> para uma célula para realocação rápida.
        </p>
      </div>

      {drag.active && drag.pos ? (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold shadow-lg"
          style={{ left: drag.pos.x + 12, top: drag.pos.y - 12 }}
        >
          {drag.dragLabel ?? "Mover turno"}
        </div>
      ) : null}


        </>
      )}



      <DuplicateWeekDialog open={dupOpen} onOpenChange={setDupOpen} weekStart={weekStart} />
      <AutofillDialog open={autoOpen} onOpenChange={setAutoOpen} weekStart={weekStart} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} weekStart={weekStart} />
      <HistoryDialog open={histOpen} onOpenChange={setHistOpen} weekStart={weekStart} />
    </AppShell>
  );
}

function DuplicateWeekDialog({
  open, onOpenChange, weekStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  weekStart: string;
}) {
  const [target, setTarget] = useState(addDays(weekStart, 7));
  const [includeFreelancers, setIncludeFreelancers] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const qc = useQueryClient();
  const fn = useServerFn(duplicateWeek);
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { from_week: weekStart, to_week: target, include_freelancers: includeFreelancers, overwrite } }),
    onSuccess: (r) => {
      toast.success(`${r.inserted} turnos copiados`);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const targetLabel = `${target.slice(8, 10)}/${target.slice(5, 7)} — ${addDays(target, 6).slice(8, 10)}/${addDays(target, 6).slice(5, 7)}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) { setTarget(addDays(weekStart, 7)); setOverwrite(false); }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicar Semana</DialogTitle>
          <DialogDescription>Copia todos os turnos desta semana para outra.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Semana de destino</Label>
            <div className="flex items-center gap-2 mt-1">
              <Button size="icon" variant="outline" onClick={() => setTarget(addDays(target, -7))} aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="flex-1 text-center font-mono text-sm font-bold">{targetLabel}</span>
              <Button size="icon" variant="outline" onClick={() => setTarget(addDays(target, 7))} aria-label="Próxima">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={includeFreelancers} onCheckedChange={(v) => setIncludeFreelancers(v === true)} />
            Incluir freelancers
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(v === true)} />
            Substituir turnos existentes no destino
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={m.isPending || target === weekStart} onClick={() => m.mutate()}>
            {m.isPending ? "Copiando..." : "Duplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

