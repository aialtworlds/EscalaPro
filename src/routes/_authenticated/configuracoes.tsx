import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { listSectors, createSector, deleteSector } from "@/lib/sectors.functions";
import { listEmployees, createEmployee, deleteEmployee } from "@/lib/employees.functions";
import { ROLE_LABELS } from "@/lib/date-utils";

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
  const deleteSectorFn = useServerFn(deleteSector);
  const createEmpFn = useServerFn(createEmployee);
  const deleteEmpFn = useServerFn(deleteEmployee);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });

  const [newSector, setNewSector] = useState("");
  const [emp, setEmp] = useState({ name: "", role_profile: "clt_regular" as const, entry_time: "08:00", journey_hours: 8, sector_id: "" });

  const createSectorM = useMutation({
    mutationFn: (name: string) => createSectorFn({ data: { name } }),
    onSuccess: () => { toast.success("Setor criado"); setNewSector(""); qc.invalidateQueries({ queryKey: ["sectors"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const deleteSectorM = useMutation({
    mutationFn: (id: string) => deleteSectorFn({ data: { id } }),
    onSuccess: () => { toast.success("Setor removido"); qc.invalidateQueries({ queryKey: ["sectors"] }); },
  });
  const createEmpM = useMutation({
    mutationFn: () => createEmpFn({ data: { ...emp, sector_id: emp.sector_id || null } }),
    onSuccess: () => {
      toast.success("Colaborador cadastrado");
      setEmp({ name: "", role_profile: "clt_regular", entry_time: "08:00", journey_hours: 8, sector_id: "" });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const deleteEmpM = useMutation({
    mutationFn: (id: string) => deleteEmpFn({ data: { id } }),
    onSuccess: () => { toast.success("Colaborador removido"); qc.invalidateQueries({ queryKey: ["employees"] }); },
  });

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Configurações Operacionais</p>
        <h1 className="text-lg font-bold">Setores e Colaboradores</h1>
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
            <div key={s.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
              <span className="text-sm font-medium">{s.name}</span>
              <button
                onClick={() => confirm("Remover setor?") && deleteSectorM.mutate(s.id)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">2. Cadastro de Colaboradores</h2>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={emp.name} onChange={(e) => setEmp({ ...emp, name: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <Label className="text-xs">Perfil Regulador</Label>
            <Select value={emp.role_profile} onValueChange={(v: any) => setEmp({ ...emp, role_profile: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clt_regular">CLT Regular (Padrão)</SelectItem>
                <SelectItem value="estagiario">Estagiário (Máx 6h)</SelectItem>
                <SelectItem value="clt_mulher">CLT Mulher (Proteção Domingo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Entrada</Label>
              <Input type="time" value={emp.entry_time} onChange={(e) => setEmp({ ...emp, entry_time: e.target.value })} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Jornada (horas)</Label>
              <Input type="number" min={1} max={12} step={0.5} value={emp.journey_hours} onChange={(e) => setEmp({ ...emp, journey_hours: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={emp.sector_id} onValueChange={(v) => setEmp({ ...emp, sector_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                {sectors.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!emp.name || createEmpM.isPending} onClick={() => createEmpM.mutate()}>
            Salvar na Base
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {employees.data?.map((e) => (
            <div key={e.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">
                  {ROLE_LABELS[e.role_profile]} • {e.sectors?.name ?? "Sem setor"} • {e.entry_time.slice(0, 5)} / {Number(e.journey_hours)}h
                </p>
              </div>
              <button
                onClick={() => confirm("Remover colaborador?") && deleteEmpM.mutate(e.id)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

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
