// Demanda por setor e dia da semana — a "receita" que o gerador usa
// para montar a escala automaticamente.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { listSectors } from "@/lib/sectors.functions";
import { listDemands, createDemand, deleteDemand } from "@/lib/demand.functions";
import { WEEKDAY_LABELS, WEEKDAY_FULL } from "@/lib/date-utils";

export function DemandSettings() {
  const qc = useQueryClient();
  const sectorsFn = useServerFn(listSectors);
  const listFn = useServerFn(listDemands);
  const createFn = useServerFn(createDemand);
  const delFn = useServerFn(deleteDemand);

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });
  const demands = useQuery({ queryKey: ["demands"], queryFn: () => listFn() });

  const [sectorId, setSectorId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [headcount, setHeadcount] = useState(1);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          sector_id: sectorId || null,
          weekdays,
          start_time: start,
          end_time: end,
          headcount,
        },
      }),
    onSuccess: (r) => { toast.success(`${r.inserted} regra(s) de demanda criada(s)`); qc.invalidateQueries({ queryKey: ["demands"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["demands"] }); },
  });

  const toggle = (d: number) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  return (
    <section className="px-4 mt-8">
      <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">
        5. Demanda por Setor
      </h2>
      <p className="text-[11px] text-muted-foreground mb-3">
        Quantas pessoas cada setor precisa, em cada dia e horário. É a base do gerador automático.
      </p>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div>
          <Label className="text-xs">Setor</Label>
          <Select value={sectorId} onValueChange={setSectorId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {sectors.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Dias</Label>
          <div className="flex gap-1 mt-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={weekdays.includes(i)}
                className={`flex-1 py-2 rounded text-[10px] font-bold uppercase border transition-colors ${
                  weekdays.includes(i)
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
            <Input type="time" className="font-mono" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="time" className="font-mono" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Pessoas</Label>
            <Input type="number" min={1} max={50} value={headcount} onChange={(e) => setHeadcount(Number(e.target.value))} />
          </div>
        </div>

        <Button className="w-full" disabled={!weekdays.length || create.isPending} onClick={() => create.mutate()}>
          Adicionar demanda
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {demands.data?.map((d) => (
          <div key={d.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">
                {d.sectors?.name ?? "Sem setor"} • <span className="font-mono">{d.start_time.slice(0, 5)}–{d.end_time.slice(0, 5)}</span>
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">
                {WEEKDAY_FULL[d.weekday]} • {d.headcount} pessoa(s)
              </p>
            </div>
            <button onClick={() => remove.mutate(d.id)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remover demanda">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {!demands.data?.length && (
          <p className="text-xs text-muted-foreground italic">Nenhuma demanda cadastrada.</p>
        )}
      </div>
    </section>
  );
}
