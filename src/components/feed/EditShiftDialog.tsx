import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CltPanel } from "@/components/CltBadge";
import { updateShift, deleteShift, clearAbsence } from "@/lib/shifts.functions";
import { trimTime } from "@/lib/date-utils";
import type { Violation } from "@/lib/clt-rules";
import type { DayShift, SectorRow, ShiftPatch } from "@/lib/types";

export type ComplianceCheck = (
  shift: DayShift,
  patch?: ShiftPatch,
) => { violations: Violation[]; configWarnings: string[] };

export function EditShiftDialog({
  shift, sectors, check, onOpenChange, onSaved,
}: {
  shift: DayShift | null;
  sectors: SectorRow[];
  check: ComplianceCheck;
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
          id: shift!.id,
          start_time: start,
          end_time: end,
          sector_id: sector || null,
          freelancer_label: shift!.is_freelancer ? label || null : undefined,
        },
      }),
    onSuccess: () => { toast.success("Turno atualizado"); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: shift!.id } }),
    onSuccess: () => { toast.success("Turno excluído"); onSaved(); onOpenChange(false); setConfirmDelete(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const revert = useMutation({
    mutationFn: () => clearFn({ data: { id: shift!.id } }),
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
          {shift && shift.status !== "absent" && (
            <div className="rounded-lg border border-border bg-secondary/40 p-2.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Conformidade CLT</p>
              <CltPanel {...check(shift, { start_time: start, end_time: end })} />
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
