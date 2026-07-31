import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HhmmInput } from "@/components/HhmmInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createShift } from "@/lib/shifts.functions";
import type { SectorRow } from "@/lib/types";

export const SHIFT_PRESETS = [
  { label: "Manhã", start: "08:00", end: "16:00" },
  { label: "Tarde", start: "14:00", end: "22:00" },
  { label: "Noite", start: "18:00", end: "02:00" },
] as const;

export function FreelancerSheet({
  open, onOpenChange, date, sectorId, sectors, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  sectorId: string | null;
  sectors: SectorRow[];
  onCreated: () => void;
}) {
  const [preset, setPreset] = useState<number | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [label, setLabel] = useState("");
  const [pickedSector, setPickedSector] = useState<string | null>(sectorId);
  const createFn = useServerFn(createShift);
  const m = useMutation({
    mutationFn: (v: { start: string; end: string }) =>
      createFn({
        data: {
          employee_id: null,
          sector_id: pickedSector,
          shift_date: date,
          start_time: v.start,
          end_time: v.end,
          is_freelancer: true,
          freelancer_label: label || null,
          is_extra: true,
        },
      }),
    onSuccess: () => {
      toast.success("Freelancer alocado");
      onCreated();
      onOpenChange(false);
      setLabel("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const isCustom = preset === 3;
  const start = isCustom || preset === null ? customStart : SHIFT_PRESETS[preset].start;
  const end = isCustom || preset === null ? customEnd : SHIFT_PRESETS[preset].end;
  const canSubmit = !!start && !!end;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-[440px] mx-auto">
        <SheetHeader>
          <SheetTitle>Injetar Freelancer</SheetTitle>
          <SheetDescription>Selecione o turno para cobertura imediata.</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {SHIFT_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={`p-4 border rounded-xl text-left transition ${
                preset === i ? "bg-primary/5 border-primary ring-2 ring-primary" : "border-border bg-card"
              }`}
            >
              <p className={`text-[10px] font-bold uppercase ${preset === i ? "text-primary" : "text-muted-foreground"}`}>{p.label}</p>
              <p className="font-mono text-sm font-bold mt-1">{p.start} — {p.end}</p>
            </button>
          ))}
          <button
            onClick={() => setPreset(3)}
            className={`p-4 border rounded-xl text-left transition border-dashed ${
              isCustom ? "bg-primary/5 border-primary ring-2 ring-primary" : "border-border"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase ${isCustom ? "text-primary" : "text-muted-foreground"}`}>Custom</p>
            <p className="font-mono text-sm font-bold mt-1">Definir</p>
          </button>
        </div>

        {(isCustom || preset === null) && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <Label className="text-xs">Início</Label>
              <HhmmInput value={customStart} onChange={setCustomStart} clock aria-label="Início" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <HhmmInput value={customEnd} onChange={setCustomEnd} clock aria-label="Fim" />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={pickedSector ?? ""} onValueChange={(v) => setPickedSector(v || null)}>
              <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rótulo (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: João Freelancer" />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            className="w-full font-bold tracking-wide"
            disabled={m.isPending || !canSubmit}
            onClick={() => m.mutate({ start, end })}
          >
            {m.isPending ? "Alocando..." : "CONFIRMAR ALOCAÇÃO"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
