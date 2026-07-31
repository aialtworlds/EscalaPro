// Turnos de cada setor — a "receita" que o gerador usa para montar a escala.
//
// Cada turno tem nome próprio ("Manhã", "Noite"), horário, quantas pessoas
// precisa e se aceita apenas gente do próprio setor. Tudo editável depois.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, X } from "lucide-react";
import { HhmmInput } from "@/components/HhmmInput";
import { listSectors } from "@/lib/sectors.functions";
import { listDemands, createDemand, updateDemand, deleteDemand } from "@/lib/demand.functions";
import { WEEKDAY_LABELS, WEEKDAY_FULL } from "@/lib/date-utils";

const NONE = "__none__";

type Draft = {
  label: string;
  sector_id: string | null;
  weekdays: number[];
  start: string;
  end: string;
  headcount: string;
  sector_only: boolean;
};

const empty: Draft = {
  label: "",
  sector_id: null,
  weekdays: [],
  start: "",
  end: "",
  headcount: "",
  sector_only: true,
};

export function DemandSettings() {
  const qc = useQueryClient();
  const sectorsFn = useServerFn(listSectors);
  const listFn = useServerFn(listDemands);
  const createFn = useServerFn(createDemand);
  const updateFn = useServerFn(updateDemand);
  const delFn = useServerFn(deleteDemand);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });
  const demands = useQuery({ queryKey: ["demands"], queryFn: () => listFn() });

  const [form, setForm] = useState<Draft>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["demands"] });
    setForm(empty);
    setEditingId(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const headcount = Number(form.headcount);
      if (!Number.isInteger(headcount) || headcount < 1) throw new Error("Informe quantas pessoas o turno exige.");
      if (!/^\d{2}:\d{2}$/.test(form.start) || !/^\d{2}:\d{2}$/.test(form.end))
        throw new Error("Informe início e fim no formato HH:MM.");
      const base = {
        label: form.label || null,
        sector_id: form.sector_id,
        start_time: form.start,
        end_time: form.end,
        headcount,
        sector_only: form.sector_only,
      };
      if (editingId) {
        return updateFn({ data: { id: editingId, weekday: form.weekdays[0], ...base } });
      }
      return createFn({ data: { weekdays: form.weekdays, ...base } });
    },
    onSuccess: () => { toast.success(editingId ? "Turno atualizado" : "Turno cadastrado"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Turno removido"); invalidate(); },
  });

  const toggle = (d: number) =>
    setForm((f) => ({
      ...f,
      weekdays: editingId
        ? [d]
        : f.weekdays.includes(d)
          ? f.weekdays.filter((x) => x !== d)
          : [...f.weekdays, d].sort(),
    }));

  const startEdit = (d: {
    id: string; label: string | null; sector_id: string | null; weekday: number;
    start_time: string; end_time: string; headcount: number; sector_only: boolean;
  }) => {
    setEditingId(d.id);
    setForm({
      label: d.label ?? "",
      sector_id: d.sector_id,
      weekdays: [d.weekday],
      start: d.start_time.slice(0, 5),
      end: d.end_time.slice(0, 5),
      headcount: String(d.headcount),
      sector_only: d.sector_only ?? true,
    });
  };

  return (
    <section className="px-4 mt-8">
      <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">
        5. Turnos por Setor
      </h2>
      <p className="text-[11px] text-muted-foreground mb-3">
        Os turnos reais de cada setor. O gerador usa exatamente estes horários (inclusive
        virada de meia-noite) e só considera o turno coberto quando alguém do setor cumpre a
        janela inteira — encostar no horário não conta.
      </p>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {editingId && (
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
            <span>Editando turno salvo</span>
            <button onClick={() => { setEditingId(null); setForm(empty); }} aria-label="Cancelar edição">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div>
          <Label className="text-xs">Nome do turno</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Ex: Manhã, Fechamento"
          />
        </div>

        <div>
          <Label className="text-xs">Setor</Label>
          <Select
            value={form.sector_id ?? NONE}
            onValueChange={(v) => setForm({ ...form, sector_id: v === NONE ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem setor</SelectItem>
              {sectors.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">{editingId ? "Dia" : "Dias"}</Label>
          <div className="flex gap-1 mt-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={form.weekdays.includes(i)}
                className={`flex-1 py-2 rounded text-[10px] font-bold uppercase border transition-colors ${
                  form.weekdays.includes(i)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Início</Label>
            <HhmmInput clock value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <HhmmInput clock value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
          </div>
          <div>
            <Label className="text-xs">Pessoas</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.headcount}
              onChange={(e) => setForm({ ...form, headcount: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox
            checked={form.sector_only}
            onCheckedChange={(v) => setForm({ ...form, sector_only: !!v })}
            className="mt-0.5"
          />
          <span className="text-xs leading-snug">
            Só colaboradores deste setor
            <span className="block text-muted-foreground">
              Desmarque para permitir que gente de outro setor cubra este turno.
            </span>
          </span>
        </label>

        <Button
          className="w-full"
          disabled={!form.weekdays.length || save.isPending}
          onClick={() => save.mutate()}
        >
          {editingId ? "Salvar alterações" : "Adicionar turno"}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {demands.data?.map((d) => (
          <div key={d.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {d.label ? `${d.label} • ` : ""}{d.sectors?.name ?? "Sem setor"}{" "}
                <span className="font-mono">{d.start_time.slice(0, 5)}–{d.end_time.slice(0, 5)}</span>
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">
                {WEEKDAY_FULL[d.weekday]} • {d.headcount} pessoa(s)
                {d.sector_only === false ? " • aberto a outros setores" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => startEdit(d)} className="text-muted-foreground hover:text-primary p-1" aria-label={`Editar turno ${d.label ?? ""}`}>
                <Pencil className="size-4" />
              </button>
              <button onClick={() => remove.mutate(d.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remover turno">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {!demands.data?.length && (
          <p className="text-xs text-muted-foreground italic">Nenhum turno cadastrado.</p>
        )}
      </div>
    </section>
  );
}
