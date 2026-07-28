// Link público somente-leitura da semana, para mandar no grupo.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Trash2 } from "lucide-react";
import { listShares, createShare, revokeShare } from "@/lib/share.functions";

export function ShareDialog({
  open, onOpenChange, weekStart,
}: { open: boolean; onOpenChange: (o: boolean) => void; weekStart: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listShares);
  const createFn = useServerFn(createShare);
  const revokeFn = useServerFn(revokeShare);

  const shares = useQuery({
    queryKey: ["shares", weekStart],
    queryFn: () => listFn({ data: { week_start: weekStart } }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: (days: number | null) => createFn({ data: { week_start: weekStart, days_valid: days } }),
    onSuccess: () => { toast.success("Link criado"); qc.invalidateQueries({ queryKey: ["shares", weekStart] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("Link revogado"); qc.invalidateQueries({ queryKey: ["shares", weekStart] }); },
  });

  const urlFor = (token: string) =>
    typeof window === "undefined" ? `/e/${token}` : `${window.location.origin}/e/${token}`;

  async function share(token: string) {
    const url = urlFor(token);
    const text = `Escala da semana: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Escala da semana", text, url }); return; } catch { /* cancelado */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartilhar Semana</DialogTitle>
          <DialogDescription>
            Quem tem o link vê a escala em modo leitura, sem precisar de conta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => create.mutate(7)} disabled={create.isPending}>
            7 dias
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => create.mutate(30)} disabled={create.isPending}>
            30 dias
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => create.mutate(null)} disabled={create.isPending}>
            Sem prazo
          </Button>
        </div>

        <div className="space-y-2">
          {shares.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] truncate">/e/{s.token}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.expires_at ? `Expira em ${new Date(s.expires_at).toLocaleDateString("pt-BR")}` : "Sem expiração"}
                </p>
              </div>
              <button onClick={() => share(s.token)} className="p-1.5 text-primary" aria-label="Copiar link">
                <Copy className="size-4" />
              </button>
              <button onClick={() => revoke.mutate(s.id)} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Revogar link">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {!shares.data?.length && (
            <p className="text-xs text-muted-foreground italic">Nenhum link ativo para esta semana.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
