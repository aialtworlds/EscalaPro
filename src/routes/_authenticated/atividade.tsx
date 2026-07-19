import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { listActivity } from "@/lib/activity.functions";

export const Route = createFileRoute("/_authenticated/atividade")({
  head: () => ({ meta: [{ title: "Atividade — EscalaPro OS" }, { name: "description", content: "Log de alterações recentes." }] }),
  component: ActivityPage,
});

const LABELS: Record<string, string> = {
  "sector.created": "Setor criado",
  "employee.created": "Colaborador cadastrado",
  "shift.created": "Turno criado",
  "shift.freelancer_injected": "Freelancer injetado",
  "shift.block_adjusted": "Bloco ajustado",
  "shift.absent_registered": "Falta registrada",
  "scan.applied": "Escala escaneada aplicada",
};

function ActivityPage() {
  const fn = useServerFn(listActivity);
  const q = useQuery({ queryKey: ["activity"], queryFn: () => fn() });

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Alterações Recentes</p>
        <h1 className="text-lg font-bold">Log Operacional</h1>
      </div>
      <div className="px-4 space-y-2">
        {q.isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {q.data?.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Sem atividades ainda.</p>}
        {q.data?.map((e) => (
          <div key={e.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{LABELS[e.event_type] ?? e.event_type}</p>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {Object.keys(e.payload as any).length > 0 && (
              <pre className="text-[10px] text-muted-foreground mt-1 font-mono overflow-x-auto">{JSON.stringify(e.payload, null, 0)}</pre>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
