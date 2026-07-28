// Histórico da semana: pontos de restauração e desfazer.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RotateCcw, Trash2 } from "lucide-react";
import { listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot } from "@/lib/snapshots.functions";

export function HistoryDialog({
  open, onOpenChange, weekStart,
}: { open: boolean; onOpenChange: (o: boolean) => void; weekStart: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSnapshots);
  const createFn = useServerFn(createSnapshot);
  const restoreFn = useServerFn(restoreSnapshot);
  const delFn = useServerFn(deleteSnapshot);

  const snaps = useQuery({
    queryKey: ["snapshots", weekStart],
    queryFn: () => listFn({ data: { week_start: weekStart } }),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["snapshots"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  const save = useMutation({
    mutationFn: () => createFn({ data: { week_start: weekStart } }),
    onSuccess: () => { toast.success("Ponto de restauração salvo"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: (r) => { toast.success(`Semana restaurada (${r.restored} turnos)`); invalidate(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => invalidate(),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da Semana</DialogTitle>
          <DialogDescription>
            Cada geração, duplicação ou restauração salva o estado anterior automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Button variant="outline" size="sm" className="text-xs" onClick={() => save.mutate()} disabled={save.isPending}>
          Salvar ponto agora
        </Button>

        <div className="space-y-2">
          {snaps.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {new Date(s.created_at).toLocaleString("pt-BR")} • {s.count} turnos
                </p>
              </div>
              <button
                onClick={() => confirm("Restaurar a semana para este ponto?") && restore.mutate(s.id)}
                className="p-1.5 text-primary"
                aria-label="Restaurar"
              >
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => remove.mutate(s.id)} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Excluir ponto">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {!snaps.data?.length && (
            <p className="text-xs text-muted-foreground italic">Nenhum ponto salvo para esta semana.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
