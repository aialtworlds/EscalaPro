import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Rocket } from "lucide-react";
import { seedWorkspace, STARTER_SECTORS } from "@/lib/onboarding.functions";

type Draft = { name: string; sector_index: number; entry_time: string; journey_hours: number };

export function OnboardingWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [sectors, setSectors] = useState<string[]>([...STARTER_SECTORS]);
  const [sectorInput, setSectorInput] = useState("");
  const [employees, setEmployees] = useState<Draft[]>([]);
  const [name, setName] = useState("");
  const [sectorIndex, setSectorIndex] = useState(0);
  const [entry, setEntry] = useState("08:00");
  const [hours, setHours] = useState(8);

  const qc = useQueryClient();
  const seedFn = useServerFn(seedWorkspace);
  const m = useMutation({
    mutationFn: () => seedFn({ data: { sectors, employees } }),
    onSuccess: (r) => {
      toast.success(`${r.sectors} setores e ${r.employees} colaboradores criados`);
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar estrutura"),
  });

  function addSector() {
    const v = sectorInput.trim();
    if (!v || sectors.includes(v)) return;
    setSectors([...sectors, v]);
    setSectorInput("");
  }

  function addEmployee() {
    const v = name.trim();
    if (!v) return;
    setEmployees([...employees, { name: v, sector_index: sectorIndex, entry_time: entry, journey_hours: hours }]);
    setName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" /> Configuração inicial
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Quais setores existem na sua operação?" : "Cadastre os primeiros colaboradores (opcional)."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {sectors.map((s, i) => (
                <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs font-medium">
                  {s}
                  <button onClick={() => setSectors(sectors.filter((_, j) => j !== i))} aria-label={`Remover ${s}`}>
                    <X className="size-3 text-muted-foreground" />
                  </button>
                </span>
              ))}
              {!sectors.length && <p className="text-xs text-muted-foreground">Adicione ao menos um setor.</p>}
            </div>
            <div className="flex gap-2">
              <Input
                value={sectorInput}
                onChange={(e) => setSectorInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSector())}
                placeholder="Novo setor"
              />
              <Button variant="outline" size="icon" onClick={addSector} aria-label="Adicionar setor">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {employees.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-secondary border border-border rounded px-2 py-1.5">
                    <span className="font-medium truncate">{e.name}</span>
                    <span className="font-mono text-muted-foreground">{sectors[e.sector_index]} · {e.entry_time}</span>
                    <button onClick={() => setEmployees(employees.filter((_, j) => j !== i))} aria-label="Remover">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Entrada</Label>
                <Input type="time" value={entry} onChange={(e) => setEntry(e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Jornada (h)</Label>
                <Input type="number" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={String(sectorIndex)} onValueChange={(v) => setSectorIndex(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sectors.map((s, i) => <SelectItem key={s} value={String(i)}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="w-full" onClick={addEmployee}>
              <Plus className="size-4 mr-1" /> Adicionar à lista
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Depois</Button>
              <Button disabled={!sectors.length} onClick={() => setStep(2)}>Continuar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button disabled={m.isPending} onClick={() => m.mutate()}>
                {m.isPending ? "Criando..." : "Criar estrutura"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
