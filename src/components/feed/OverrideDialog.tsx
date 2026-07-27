import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerOverride } from "@/lib/compliance.functions";
import type { Violation } from "@/lib/clt-rules";
import type { DayShift } from "@/lib/types";

export type OverrideTarget = { shift: DayShift; violation: Violation };

export function OverrideDialog({
  target, onOpenChange, onSaved,
}: {
  target: OverrideTarget | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [justification, setJustification] = useState("");
  const fn = useServerFn(registerOverride);
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { shift_id: target!.shift.id, rule_code: target!.violation.code, justification } }),
    onSuccess: () => { toast.success("Liberação registrada no log"); setJustification(""); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Liberar alerta</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{target?.violation.message}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{target?.violation.basis}</p>
          <Label className="text-xs">Justificativa (fica registrada no log)</Label>
          <Input
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Ex: compensação acordada na sexta-feira"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={justification.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>
            Registrar liberação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
