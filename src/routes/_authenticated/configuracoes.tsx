import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, LogOut, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { listSectors, createSector, updateSector, deleteSector } from "@/lib/sectors.functions";
import { listEmployees, deleteEmployee } from "@/lib/employees.functions";
import { ROLE_LABELS, hoursToHHMM } from "@/lib/date-utils";
import { ComplianceSettings } from "@/components/ComplianceSettings";
import { ConstraintsSettings } from "@/components/ConstraintsSettings";
import { DemandSettings } from "@/components/DemandSettings";
import { PlanSettings } from "@/components/billing/PlanSettings";
import {
  EmployeeDialog, emptyEmployee, draftFromRow, type EmployeeDraft,
} from "@/components/settings/EmployeeDialog";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — EscalaPro OS" }, { name: "description", content: "Setores e cadastro de colaboradores." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sectorsFn = useServerFn(listSectors);
  const empsFn = useServerFn(listEmployees);
  const createSectorFn = useServerFn(createSector);
  const updateSectorFn = useServerFn(updateSector);
  const deleteSectorFn = useServerFn(deleteSector);
  const deleteEmpFn = useServerFn(deleteEmployee);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });

  const [newSector, setNewSector] = useState("");
  const [renamingSector, setRenamingSector] = useState<string | null>(null);
  const [sectorName, setSectorName] = useState("");
  const [empOpen, setEmpOpen] = useState(false);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyEmployee);

  const createSectorM = useMutation({
    mutationFn: (name: string) => createSectorFn({ data: { name } }),
    onSuccess: () => { toast.success("Setor criado"); setNewSector(""); qc.invalidateQueries({ queryKey: ["sectors"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const renameSectorM = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateSectorFn({ data: v }),
    onSuccess: () => {
      toast.success("Setor atualizado");
      setRenamingSector(null);
      qc.invalidateQueries({ queryKey: ["sectors"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const deleteSectorM = useMutation({
    mutationFn: (id: string) => deleteSectorFn({ data: { id } }),
    onSuccess: () => { toast.success("Setor removido"); qc.invalidateQueries({ queryKey: ["sectors"] }); },
  });
  const deleteEmpM = useMutation({
    mutationFn: (id: string) => deleteEmpFn({ data: { id } }),
    onSuccess: () => { toast.success("Colaborador removido"); qc.invalidateQueries({ queryKey: ["employees"] }); },
  });


  return (
    <AppShell>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Configurações Operacionais</p>
        <h1 className="text-lg font-bold">Setores, Colaboradores e Conformidade</h1>
      </div>

      <section className="px-4 mt-4">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">1. Setores Ativos</h2>
        <div className="flex gap-2">
          <Input value={newSector} onChange={(e) => setNewSector(e.target.value)} placeholder="Ex: Cozinha, Salão" />
          <Button onClick={() => newSector && createSectorM.mutate(newSector)} disabled={!newSector}>
            Criar
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {sectors.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-2 bg-card border border-border rounded-lg p-3">
              {renamingSector === s.id ? (
                <>
                  <Input
                    autoFocus
                    value={sectorName}
                    onChange={(e) => setSectorName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && sectorName.trim()) renameSectorM.mutate({ id: s.id, name: sectorName }); }}
                    className="h-8"
                  />
                  <Button size="sm" className="h-8" disabled={!sectorName.trim()} onClick={() => renameSectorM.mutate({ id: s.id, name: sectorName })}>
                    Salvar
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium flex-1 truncate">{s.name}</span>
                  <button
                    onClick={() => { setRenamingSector(s.id); setSectorName(s.name); }}
                    className="text-muted-foreground hover:text-primary p-1"
                    aria-label={`Renomear setor ${s.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => confirm("Remover setor?") && deleteSectorM.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label={`Remover setor ${s.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">2. Cadastro de Colaboradores</h2>
        <Button className="w-full" onClick={() => { setDraft(emptyEmployee); setEmpOpen(true); }}>
          <Plus className="size-4 mr-2" /> Novo colaborador
        </Button>

        <div className="mt-4 space-y-2">
          {employees.data?.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 bg-card border border-border rounded-lg p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{e.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">
                  {ROLE_LABELS[e.role_profile]} • {e.sectors?.name ?? "Sem setor"} • {e.entry_time.slice(0, 5)} / {hoursToHHMM(e.journey_hours)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setDraft(draftFromRow(e)); setEmpOpen(true); }}
                  className="text-muted-foreground hover:text-primary p-1"
                  aria-label={`Editar ${e.name}`}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => confirm("Remover colaborador?") && deleteEmpM.mutate(e.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label={`Remover ${e.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          {!employees.data?.length && (
            <p className="text-xs text-muted-foreground italic">Nenhum colaborador cadastrado.</p>
          )}
        </div>

        <EmployeeDialog open={empOpen} onOpenChange={setEmpOpen} initial={draft} />
      </section>


      <ComplianceSettings />

      <ConstraintsSettings />

      <DemandSettings />

      <PlanSettings />



      <section className="px-4 mt-8">
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
        >
          <LogOut className="size-4 mr-2" /> Sair
        </Button>
      </section>
    </AppShell>
  );
}
