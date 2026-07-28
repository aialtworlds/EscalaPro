// Gerador automático da semana: prévia primeiro, gravação depois.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { autofillWeek } from "@/lib/autofill.functions";
import { WEEKDAY_LABELS, weekdayOf, trimTime } from "@/lib/date-utils";

type Plan = {
  planned: { employee_name: string; shift_date: string; start_time: string; end_time: string }[];
  gaps: { shift_date: string; start_time: string; end_time: string; reason: string }[];
};

export function AutofillDialog({
  open, onOpenChange, weekStart,
}: { open: boolean; onOpenChange: (o: boolean) => void; weekStart: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(autofillWeek);
  const [replace, setReplace] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  const preview = useMutation({
    mutationFn: () => fn({ data: { week_start: weekStart, replace, preview: true } }),
    onSuccess: (r) => {
      setPlan({ planned: r.planned, gaps: r.gaps });
      if (!r.planned.length) toast.info("Nada a alocar com a demanda atual.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const apply = useMutation({
    mutationFn: () => fn({ data: { week_start: weekStart, replace, preview: false } }),
    onSuccess: (r) => {
      toast.success(`${r.inserted} turnos gerados${r.gaps.length ? ` • ${r.gaps.length} lacuna(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      setPlan(null);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const dayLabel = (iso: string) => `${WEEKDAY_LABELS[weekdayOf(iso)]} ${iso.slice(8, 10)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPlan(null); }}>
      <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Escala Automática</DialogTitle>
          <DialogDescription>
            Distribui a demanda cadastrada respeitando restrições, 11h de descanso, 44h semanais e folga semanal.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={replace} onCheckedChange={(v) => { setReplace(!!v); setPlan(null); }} className="mt-0.5" />
          <span className="text-xs leading-snug">
            Substituir a semana inteira
            <span className="block text-muted-foreground">
              Sem marcar, o gerador só completa o que falta. Um ponto de restauração é criado antes de gravar.
            </span>
          </span>
        </label>

        {plan && (
          <div className="border border-border rounded-lg divide-y divide-border text-xs max-h-56 overflow-y-auto">
            {plan.planned.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5">
                <span className="truncate">{p.employee_name}</span>
                <span className="font-mono text-muted-foreground shrink-0 ml-2">
                  {dayLabel(p.shift_date)} {trimTime(p.start_time)}
                </span>
              </div>
            ))}
            {plan.gaps.map((g, i) => (
              <div key={`g${i}`} className="px-3 py-1.5 text-destructive">
                <span className="font-mono">{dayLabel(g.shift_date)} {trimTime(g.start_time)}–{trimTime(g.end_time)}</span>
                <span className="block text-[10px]">{g.reason}</span>
              </div>
            ))}
            {!plan.planned.length && !plan.gaps.length && (
              <p className="px-3 py-2 text-muted-foreground">Semana já coberta pela demanda atual.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
            {preview.isPending ? "Calculando…" : "Pré-visualizar"}
          </Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
            {apply.isPending ? "Gerando…" : "Gerar escala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
