// Restrições do colaborador: indisponibilidade semanal e afastamentos.
// Alimenta o auto-preenchimento da semana. Tudo o que é salvo pode ser editado depois.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, X } from "lucide-react";
import { HhmmInput } from "@/components/HhmmInput";
import { listEmployees } from "@/lib/employees.functions";
import { listConstraints, createConstraint, updateConstraint, deleteConstraint } from "@/lib/constraints.functions";
import { WEEKDAY_FULL } from "@/lib/date-utils";

type Kind = "indisponivel_semanal" | "afastamento";

type Draft = {
  employee_id: string;
  kind: Kind;
  weekday: string;
  allDay: boolean;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
  note: string;
};

const empty: Draft = {
  employee_id: "",
  kind: "indisponivel_semanal",
  weekday: "1",
  allDay: true,
  start_time: "",
  end_time: "",
  start_date: "",
  end_date: "",
  note: "",
};

export function ConstraintsSettings() {
  const qc = useQueryClient();
  const empsFn = useServerFn(listEmployees);
  const listFn = useServerFn(listConstraints);
  const createFn = useServerFn(createConstraint);
  const updateFn = useServerFn(updateConstraint);
  const delFn = useServerFn(deleteConstraint);

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });
  const items = useQuery({ queryKey: ["constraints"], queryFn: () => listFn() });

  const [form, setForm] = useState<Draft>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => { setForm(empty); setEditingId(null); };

  const save = useMutation({
    mutationFn: async () => {
      const isWeekly = form.kind === "indisponivel_semanal";
      if (isWeekly && !form.allDay && (!/^\d{2}:\d{2}$/.test(form.start_time) || !/^\d{2}:\d{2}$/.test(form.end_time)))
        throw new Error("Informe a faixa de horário no formato HH:MM.");
      const base = {
        kind: form.kind,
        weekday: isWeekly ? Number(form.weekday) : null,
        start_time: isWeekly && !form.allDay ? form.start_time : null,
        end_time: isWeekly && !form.allDay ? form.end_time : null,
        start_date: !isWeekly ? form.start_date : null,
        end_date: !isWeekly ? form.end_date : null,
        note: form.note || null,
      };
      if (editingId) return updateFn({ data: { id: editingId, ...base } });
      return createFn({ data: { employee_id: form.employee_id, ...base } });
    },
    onSuccess: () => {
      toast.success(editingId ? "Restrição atualizada" : "Restrição registrada");
      reset();
      qc.invalidateQueries({ queryKey: ["constraints"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removida"); reset(); qc.invalidateQueries({ queryKey: ["constraints"] }); },
  });

  const startEdit = (c: {
    id: string; employee_id: string; kind: string; weekday: number | null;
    start_time: string | null; end_time: string | null;
    start_date: string | null; end_date: string | null; note: string | null;
  }) => {
    setEditingId(c.id);
    setForm({
      employee_id: c.employee_id,
      kind: (c.kind as Kind) ?? "indisponivel_semanal",
      weekday: String(c.weekday ?? 1),
      allDay: !c.start_time,
      start_time: c.start_time?.slice(0, 5) ?? "",
      end_time: c.end_time?.slice(0, 5) ?? "",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      note: c.note ?? "",
    });
  };

  const valid =
    (editingId ? true : !!form.employee_id) &&
    (form.kind === "indisponivel_semanal" || (!!form.start_date && !!form.end_date));

  return (
    <section className="px-4 mt-8">
      <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">
        4. Restrições e Afastamentos
      </h2>
      <p className="text-[11px] text-muted-foreground mb-3">
        O gerador de escala nunca aloca alguém dentro de uma restrição registrada aqui.
      </p>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {editingId && (
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
            <span>Editando restrição salva</span>
            <button onClick={reset} aria-label="Cancelar edição">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div>
          <Label className="text-xs">Colaborador</Label>
          <Select
            value={form.employee_id}
            onValueChange={(v) => setForm({ ...form, employee_id: v })}
            disabled={!!editingId}
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {employees.data?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={form.kind} onValueChange={(v: Kind) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="indisponivel_semanal">Indisponível toda semana</SelectItem>
              <SelectItem value="afastamento">Afastamento / férias (período)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.kind === "indisponivel_semanal" ? (
          <>
            <div>
              <Label className="text-xs">Dia da semana</Label>
              <Select value={form.weekday} onValueChange={(v) => setForm({ ...form, weekday: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAY_FULL.map((w, i) => <SelectItem key={w} value={String(i)}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Abrangência</Label>
              <Select value={form.allDay ? "dia" : "faixa"} onValueChange={(v) => setForm({ ...form, allDay: v === "dia" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Dia inteiro</SelectItem>
                  <SelectItem value="faixa">Faixa de horário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Das</Label>
                  <HhmmInput clock value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <HhmmInput clock value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" className="font-mono" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" className="font-mono" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Observação</Label>
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex: faculdade, férias" />
        </div>

        <Button className="w-full" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          {editingId ? "Salvar alterações" : "Registrar restrição"}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {items.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.employees?.name ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground uppercase">
                {c.kind === "afastamento"
                  ? `Afastado ${c.start_date?.slice(8, 10)}/${c.start_date?.slice(5, 7)} a ${c.end_date?.slice(8, 10)}/${c.end_date?.slice(5, 7)}`
                  : `${WEEKDAY_FULL[c.weekday ?? 0]} ${c.start_time ? `${c.start_time.slice(0, 5)}–${c.end_time?.slice(0, 5)}` : "dia inteiro"}`}
                {c.note ? ` • ${c.note}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-primary p-1" aria-label={`Editar restrição de ${c.employees?.name ?? ""}`}>
                <Pencil className="size-4" />
              </button>
              <button onClick={() => remove.mutate(c.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remover restrição">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {!items.data?.length && (
          <p className="text-xs text-muted-foreground italic">Nenhuma restrição registrada.</p>
        )}
      </div>
    </section>
  );
}
