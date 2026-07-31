// Gerador automático da semana: prévia editável primeiro, gravação depois.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { HhmmInput } from "@/components/HhmmInput";
import { autofillWeek, applyWeekPlan } from "@/lib/autofill.functions";
import { listEmployees } from "@/lib/employees.functions";
import { WEEKDAY_LABELS, weekdayOf, trimTime } from "@/lib/date-utils";
import { usePlan } from "@/hooks/usePlan";
import { UpgradeCard } from "@/components/billing/UpgradeCard";

type Draft = {
  label?: string | null;
  employee_id: string;
  sector_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
};

type Gap = { shift_date: string; sector_id?: string | null; start_time: string; end_time: string; reason: string };

export function AutofillDialog({
  open, onOpenChange, weekStart,
}: { open: boolean; onOpenChange: (o: boolean) => void; weekStart: string }) {
  const qc = useQueryClient();
  const plan = usePlan();
  const previewFn = useServerFn(autofillWeek);
  const applyFn = useServerFn(applyWeekPlan);
  const empsFn = useServerFn(listEmployees);
  const [replace, setReplace] = useState(false);
  const [mode, setMode] = useState<"week" | "month">("week");
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });
  const empName = (id: string) => employees.data?.find((e) => e.id === id)?.name ?? "—";
  const locked = mode === "month" && !plan.isPro;

  const reset = () => { setRows(null); setGaps([]); };

  const preview = useMutation({
    mutationFn: () => previewFn({ data: { week_start: weekStart, mode, replace, preview: true } }),
    onSuccess: (r) => {
      setRows(r.planned.map((p) => ({
        label: (p as { label?: string | null }).label ?? null,
        employee_id: p.employee_id,
        sector_id: (p as { sector_id?: string | null }).sector_id ?? null,
        shift_date: p.shift_date,
        start_time: trimTime(p.start_time),
        end_time: trimTime(p.end_time),
      })));
      setGaps(r.gaps as Gap[]);
      if (!r.planned.length) toast.info("Nada a alocar com a demanda atual.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const apply = useMutation({
    mutationFn: () => applyFn({ data: { week_start: weekStart, mode, replace, rows: rows ?? [] } }),
    onSuccess: (r) => {
      toast.success(`${r.inserted} turnos gerados`);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const dayLabel = (iso: string) => `${WEEKDAY_LABELS[weekdayOf(iso)]} ${iso.slice(8, 10)}`;

  const patch = (i: number, p: Partial<Draft>) =>
    setRows((prev) => prev?.map((r, idx) => (idx === i ? { ...r, ...p } : r)) ?? prev);
  const remove = (i: number) => setRows((prev) => prev?.filter((_, idx) => idx !== i) ?? prev);
  const addFromGap = (g: Gap) => {
    const first = employees.data?.[0];
    if (!first) return toast.error("Cadastre um colaborador primeiro.");
    setRows((prev) => [
      ...(prev ?? []),
      {
        employee_id: first.id,
        sector_id: g.sector_id ?? null,
        shift_date: g.shift_date,
        start_time: trimTime(g.start_time),
        end_time: trimTime(g.end_time),
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Escala Automática</DialogTitle>
          <DialogDescription>
            Gere a prévia, ajuste manualmente o que quiser e só então grave a semana.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Período
          </p>
          <div className="grid grid-cols-2 gap-1">
            {([["week", "Semana"], ["month", "Mês inteiro"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => { setMode(m); reset(); }}
                className={`py-2 rounded text-[11px] font-bold uppercase border transition-colors inline-flex items-center justify-center gap-1 ${
                  mode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {label}
                {m === "month" && !plan.isPro && <Lock className="size-3" />}
              </button>
            ))}
          </div>
        </div>

        {mode === "month" && !plan.isPro && <UpgradeCard feature="month_autofill" compact />}


        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={replace} onCheckedChange={(v) => { setReplace(!!v); reset(); }} className="mt-0.5" />
          <span className="text-xs leading-snug">
            {mode === "month" ? "Substituir o mês inteiro" : "Substituir a semana inteira"}
            <span className="block text-muted-foreground">
              Sem marcar, o gerador só completa o que falta. Um ponto de restauração é criado antes de gravar.
            </span>
          </span>
        </label>

        {rows && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Prévia editável · {rows.length} turno(s)
            </p>
            <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className="p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground w-14 shrink-0">
                      {dayLabel(r.shift_date)}
                    </span>
                    <select
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={r.employee_id}
                      onChange={(e) => patch(i, { employee_id: e.target.value })}
                      aria-label="Colaborador"
                    >
                      {employees.data?.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                    <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => remove(i)} aria-label={`Remover turno de ${empName(r.employee_id)}`}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                  {r.label && (
                    <p className="pl-16 text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</p>
                  )}
                  <div className="flex items-center gap-2 pl-16">
                    <HhmmInput
                      clock className="h-8 text-xs" value={r.start_time}
                      onChange={(v) => patch(i, { start_time: v })} aria-label="Início"
                    />
                    <HhmmInput
                      clock className="h-8 text-xs" value={r.end_time}
                      onChange={(v) => patch(i, { end_time: v })} aria-label="Fim"
                    />
                  </div>
                </div>
              ))}
              {!rows.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum turno na prévia.</p>
              )}
            </div>

            {gaps.length > 0 && (
              <div className="border border-border rounded-lg divide-y divide-border text-xs max-h-40 overflow-y-auto">
                {gaps.map((g, i) => (
                  <div key={`g${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <div className="text-destructive min-w-0">
                      <span className="font-mono">{dayLabel(g.shift_date)} {trimTime(g.start_time)}–{trimTime(g.end_time)}</span>
                      <span className="block text-[10px] truncate">{g.reason}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => addFromGap(g)} aria-label="Preencher lacuna manualmente">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending || locked}>
            {preview.isPending ? "Calculando…" : rows ? "Recalcular" : "Pré-visualizar"}
          </Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending || locked || !rows || !rows.length}>
            {apply.isPending ? "Salvando…" : "Salvar escala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
