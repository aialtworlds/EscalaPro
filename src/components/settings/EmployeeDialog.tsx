// Cadastro de colaborador — mesmo formulário para criar e para editar.
//
// Todo campo salvo continua editável depois: nome, perfil, entrada, jornada,
// setor e perfil de conformidade. Nada vem pré-preenchido na criação.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HhmmInput } from "@/components/HhmmInput";
import { createEmployee, updateEmployee } from "@/lib/employees.functions";
import { listSectors } from "@/lib/sectors.functions";
import { listComplianceProfiles } from "@/lib/compliance.functions";
import { hhmmToHours, hoursToHHMM } from "@/lib/date-utils";

const NONE = "__none__";

export type EmployeeDraft = {
  id?: string;
  name: string;
  role_profile: string;
  /** HH:MM */
  entry_time: string;
  /** HH:MM (9h40 é jornada válida) */
  journey: string;
  sector_id: string | null;
  compliance_profile_id: string | null;
};

export const emptyEmployee: EmployeeDraft = {
  name: "",
  role_profile: "clt_regular",
  entry_time: "",
  journey: "",
  sector_id: null,
  compliance_profile_id: null,
};

/** Converte a linha do banco no rascunho editável. */
export function draftFromRow(row: {
  id: string;
  name: string;
  role_profile: string;
  entry_time: string;
  journey_hours: number | string;
  sector_id: string | null;
  compliance_profile_id?: string | null;
}): EmployeeDraft {
  return {
    id: row.id,
    name: row.name,
    role_profile: row.role_profile,
    entry_time: row.entry_time.slice(0, 5),
    journey: hoursToHHMM(row.journey_hours),
    sector_id: row.sector_id,
    compliance_profile_id: row.compliance_profile_id ?? null,
  };
}

export function EmployeeDialog({
  open, onOpenChange, initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: EmployeeDraft;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createEmployee);
  const updateFn = useServerFn(updateEmployee);
  const sectorsFn = useServerFn(listSectors);
  const profilesFn = useServerFn(listComplianceProfiles);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });
  const profiles = useQuery({ queryKey: ["compliance-profiles"], queryFn: () => profilesFn() });

  const [form, setForm] = useState(initial);
  useEffect(() => { if (open) setForm(initial); }, [open, initial]);

  const editing = !!form.id;

  const save = useMutation({
    mutationFn: async () => {
      const hours = hhmmToHours(form.journey);
      if (!hours) throw new Error("Informe a jornada no formato HH:MM (ex: 09:40).");
      if (!/^\d{2}:\d{2}$/.test(form.entry_time)) throw new Error("Informe a entrada no formato HH:MM.");
      const payload = {
        name: form.name.trim(),
        role_profile: form.role_profile as "clt_regular",
        entry_time: form.entry_time,
        journey_hours: hours,
        sector_id: form.sector_id,
        compliance_profile_id: form.compliance_profile_id,
      };
      return form.id
        ? updateFn({ data: { id: form.id, ...payload } })
        : createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Cadastro atualizado" : "Colaborador cadastrado");
      qc.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
          <DialogDescription>
            Jornada e entrada em HH:MM — jornadas quebradas como 09:40 são aceitas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome completo"
            />
          </div>

          <div>
            <Label className="text-xs">Perfil regulador</Label>
            <Select value={form.role_profile} onValueChange={(v) => setForm({ ...form, role_profile: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clt_regular">CLT Regular (Padrão)</SelectItem>
                <SelectItem value="estagiario">Estagiário (Máx 6h)</SelectItem>
                <SelectItem value="clt_mulher">CLT Mulher (Proteção Domingo)</SelectItem>
                <SelectItem value="escala_12x36">Escala 12x36</SelectItem>
                <SelectItem value="pj">PJ / Prestador (fora da CLT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Entrada (HH:MM)</Label>
              <HhmmInput clock value={form.entry_time} onChange={(v) => setForm({ ...form, entry_time: v })} />
            </div>
            <div>
              <Label className="text-xs">Jornada (HH:MM)</Label>
              <HhmmInput value={form.journey} onChange={(v) => setForm({ ...form, journey: v })} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Setor</Label>
            <Select
              value={form.sector_id ?? NONE}
              onValueChange={(v) => setForm({ ...form, sector_id: v === NONE ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem setor</SelectItem>
                {sectors.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Perfil de jornada / conformidade</Label>
            <Select
              value={form.compliance_profile_id ?? NONE}
              onValueChange={(v) => setForm({ ...form, compliance_profile_id: v === NONE ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Base federal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Base federal (padrão)</SelectItem>
                {profiles.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={!form.name.trim() || !form.journey || !form.entry_time || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
