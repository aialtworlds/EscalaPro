// Restrições do colaborador: indisponibilidade semanal e afastamentos.
// Alimenta o auto-preenchimento da semana.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { listEmployees } from "@/lib/employees.functions";
import { listConstraints, createConstraint, deleteConstraint } from "@/lib/constraints.functions";
import { WEEKDAY_FULL } from "@/lib/date-utils";

type Kind = "indisponivel_semanal" | "afastamento";

export function ConstraintsSettings() {
  const qc = useQueryClient();
  const empsFn = useServerFn(listEmployees);
  const listFn = useServerFn(listConstraints);
  const createFn = useServerFn(createConstraint);
  const delFn = useServerFn(deleteConstraint);

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });
  const items = useQuery({ queryKey: ["constraints"], queryFn: () => listFn() });

  const [form, setForm] = useState({
    employee_id: "",
    kind: "indisponivel_semanal" as Kind,
    weekday: "1",
    allDay: true,
    start_time: "18:00",
    end_time: "23:00",
    start_date: "",
    end_date: "",
    note: "",
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          employee_id: form.employee_id,
          kind: form.kind,
          weekday: form.kind === "indisponivel_semanal" ? Number(form.weekday) : null,
          start_time: form.kind === "indisponivel_semanal" && !form.allDay ? form.start_time : null,
          end_time: form.kind === "indisponivel_semanal" && !form.allDay ? form.end_time : null,
          start_date: form.kind === "afastamento" ? form.start_date : null,
          end_date: form.kind === "afastamento" ? form.end_date : null,
          note: form.note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Restrição registrada");
      setForm({ ...form, note: "" });
      qc.invalidateQueries({ queryKey: ["constraints"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["constraints"] }); },
  });

  const valid =
    !!form.employee_id &&
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
        <div>
          <Label className="text-xs">Colaborador</Label>
          <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
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
                  <Input type="time" className="font-mono" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="time" className="font-mono" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
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

        <Button className="w-full" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
          Registrar restrição
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
            <button onClick={() => remove.mutate(c.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remover restrição">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {!items.data?.length && (
          <p className="text-xs text-muted-foreground italic">Nenhuma restrição registrada.</p>
        )}
      </div>
    </section>
  );
}
