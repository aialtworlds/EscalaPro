import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markShiftAbsent } from "@/lib/shifts.functions";
import { formatDatePt } from "@/lib/date-utils";
import type { DayShift } from "@/lib/types";

export function AbsenceDialog({
  shift, onOpenChange, onSaved,
}: {
  shift: DayShift | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const fn = useServerFn(markShiftAbsent);
  const m = useMutation({
    mutationFn: () => fn({ data: { id: shift!.id, reason: reason || undefined } }),
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
