import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Sparkles, ArrowLeft, ChevronLeft, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { scanSchedule, applyScan, type ScanResult } from "@/lib/scan.functions";
import { listEmployees, createEmployee } from "@/lib/employees.functions";
import { listSectors } from "@/lib/sectors.functions";
import { mondayOf, addDays, todayISO, WEEKDAY_MAP_PT, WEEKDAY_FULL } from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/escanear")({
  head: () => ({ meta: [{ title: "Escanear Escala — EscalaPro OS" }, { name: "description", content: "Vision Engine: leia escalas em papel com IA." }] }),
  component: ScanPage,
});

function ScanPage() {
  const [step, setStep] = useState<"pick" | "processing" | "review">("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [sectorId, setSectorId] = useState<string>("");
  const [mapping, setMapping] = useState<Record<number, string>>({}); // scanned employee index -> real employee id
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const scanFn = useServerFn(scanSchedule);
  const applyFn = useServerFn(applyScan);
  const empsFn = useServerFn(listEmployees);
  const sectorsFn = useServerFn(listSectors);
  const createEmpFn = useServerFn(createEmployee);
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: () => sectorsFn() });

  // Create a registered employee straight from a scanned name and auto-map it.
  const createEmpM = useMutation({
    mutationFn: (v: { index: number; name: string }) =>
      createEmpFn({
        data: {
          name: v.name,
          role_profile: "clt_regular",
          entry_time: "08:00",
          journey_hours: 8,
          sector_id: sectorId || null,
        },
      }).then((row) => ({ row, index: v.index })),
    onSuccess: ({ row, index }) => {
      setMapping((prev) => ({ ...prev, [index]: row.id }));
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Colaborador cadastrado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cadastrar"),
  });


  const scanM = useMutation({
    mutationFn: (data_url: string) => scanFn({ data: { image_data_url: data_url } }),
    onSuccess: (r) => {
      setResult(r);
      // auto-map by fuzzy name
      const map: Record<number, string> = {};
      r.employees.forEach((s, i) => {
        const norm = s.name.trim().toLowerCase();
        const match = employees.data?.find((e) => e.name.trim().toLowerCase() === norm);
        if (match) map[i] = match.id;
      });
      setMapping(map);
      setStep("review");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha na leitura");
      setStep("pick");
    },
  });

  const applyM = useMutation({
    mutationFn: () => {
      if (!result) throw new Error("Sem dados");
      const entries = result.employees
        .map((emp, i) => {
          const employee_id = mapping[i];
          if (!employee_id) return null;
          const shifts = emp.shifts
            .filter((s) => s.start_time && s.end_time && /^\d{1,2}:\d{2}$/.test(s.start_time))
            .map((s) => {
              const idx = WEEKDAY_MAP_PT[s.weekday.trim().toLowerCase()];
              if (idx === undefined) return null;
              // Monday-based offset (weekStart is a Monday)
              const dayOffset = idx === 0 ? 6 : idx - 1;
              return {
                shift_date: addDays(weekStart, dayOffset),
                start_time: normalizeTime(s.start_time),
                end_time: normalizeTime(s.end_time),
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
          return { employee_id, shifts };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null && x.shifts.length > 0);
      return applyFn({ data: { week_start: weekStart, sector_id: sectorId || null, entries } });
    },
    onSuccess: (r) => {
      toast.success(`${r.inserted} turnos gravados`);
      qc.invalidateQueries({ queryKey: ["shifts"] });
      navigate({ to: "/semana" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  async function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setStep("processing");
      scanM.mutate(dataUrl);
    };
    reader.readAsDataURL(f);
  }

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        {step !== "pick" && (
          <button onClick={() => setStep("pick")} className="p-1"><ArrowLeft className="size-5" /></button>
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-1">
            <Sparkles className="size-3" /> Vision Engine
          </p>
          <h1 className="text-lg font-bold">Escanear Escala</h1>
        </div>
      </div>

      {step === "pick" && (
        <div className="px-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Aponte para a escala anterior, rascunho ou folha em papel. A IA extrai os funcionários e turnos.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="p-6 bg-card border border-border rounded-xl flex flex-col items-center gap-2 hover:border-primary transition"
            >
              <Camera className="size-8 text-primary" />
              <span className="font-bold">Tirar Foto</span>
              <span className="text-xs text-muted-foreground">Use a câmera</span>
            </button>
            <button
              onClick={() => uploadRef.current?.click()}
              className="p-6 bg-card border border-border rounded-xl flex flex-col items-center gap-2 hover:border-primary transition"
            >
              <Upload className="size-8 text-primary" />
              <span className="font-bold">Enviar Imagem</span>
              <span className="text-xs text-muted-foreground">Da galeria</span>
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <p className="text-xs text-muted-foreground text-center pt-2">Módulo de Visão Computacional ativo.</p>
        </div>
      )}

      {step === "processing" && (
        <div className="px-4 py-12 text-center space-y-4">
          {preview && <img src={preview} alt="Escala" className="mx-auto max-h-60 rounded-lg border border-border" />}
          <div className="animate-pulse">
            <Sparkles className="size-8 text-primary mx-auto mb-2" />
            <p className="font-bold">IA processando imagem...</p>
            <p className="text-xs text-muted-foreground">Extraindo funcionários e turnos.</p>
          </div>
        </div>
      )}

      {step === "review" && result && (
        <div className="px-4 space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs">
            Revise e corrija antes de gravar. Tudo abaixo é editável.
          </div>

          {preview && (
            <img src={preview} alt="Escala escaneada" className="w-full max-h-40 object-contain rounded-lg border border-border" />
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Semana destino</label>
            <div className="flex items-center gap-2 mt-1">
              <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="flex-1 text-center font-mono text-sm font-bold">
                {weekStart.slice(8, 10)}/{weekStart.slice(5, 7)} — {addDays(weekStart, 6).slice(8, 10)}/{addDays(weekStart, 6).slice(5, 7)}
              </span>
              <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Próxima semana">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Setor destino</label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                {sectors.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {result.employees.map((emp, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm truncate">{emp.name}</p>
                  <button
                    onClick={() => {
                      setResult({ employees: result.employees.filter((_, k) => k !== i) });
                      const next: Record<number, string> = {};
                      Object.entries(mapping).forEach(([k, v]) => {
                        const n = Number(k);
                        if (n < i) next[n] = v;
                        else if (n > i) next[n - 1] = v;
                      });
                      setMapping(next);
                    }}
                    className="text-[10px] font-bold uppercase text-destructive"
                  >
                    Descartar
                  </button>
                </div>
                <div className="flex gap-2">
                  <Select value={mapping[i] ?? ""} onValueChange={(v) => setMapping({ ...mapping, [i]: v })}>
                    <SelectTrigger><SelectValue placeholder="Mapear para colaborador cadastrado" /></SelectTrigger>
                    <SelectContent>
                      {employees.data?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!mapping[i] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      disabled={createEmpM.isPending}
                      onClick={() => createEmpM.mutate({ index: i, name: emp.name })}
                    >
                      <UserPlus className="size-3.5 mr-1" /> Criar
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  {emp.shifts.map((s, j) => {
                    const idx = WEEKDAY_MAP_PT[s.weekday.trim().toLowerCase()];
                    const label = idx !== undefined ? WEEKDAY_FULL[idx].slice(0, 3) : s.weekday.slice(0, 3);
                    const patch = (field: "start_time" | "end_time", value: string) => {
                      const employeesCopy = result.employees.map((e, k) =>
                        k !== i ? e : { ...e, shifts: e.shifts.map((sh, l) => (l === j ? { ...sh, [field]: value } : sh)) },
                      );
                      setResult({ employees: employeesCopy });
                    };
                    return (
                      <div key={j} className="flex items-center gap-2">
                        <span className="w-9 text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
                        <Input
                          type="time"
                          value={s.start_time ? normalizeTime(s.start_time) : ""}
                          onChange={(e) => patch("start_time", e.target.value)}
                          className="h-8 font-mono text-xs px-2"
                        />
                        <Input
                          type="time"
                          value={s.end_time ? normalizeTime(s.end_time) : ""}
                          onChange={(e) => patch("end_time", e.target.value)}
                          className="h-8 font-mono text-xs px-2"
                        />
                        <button
                          onClick={() =>
                            setResult({
                              employees: result.employees.map((e, k) =>
                                k !== i ? e : { ...e, shifts: e.shifts.filter((_, l) => l !== j) },
                              ),
                            })
                          }
                          aria-label="Remover turno"
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {!emp.shifts.length && <p className="text-[11px] text-muted-foreground">Nenhum turno detectado.</p>}
                </div>
              </div>
            ))}
          </div>

          <Button
            className="w-full font-bold tracking-wide"
            disabled={applyM.isPending || Object.keys(mapping).length === 0}
            onClick={() => applyM.mutate()}
          >
            {applyM.isPending ? "Gravando..." : "GRAVAR ESCALA NA SEMANA"}
          </Button>
        </div>
      )}

    </AppShell>
  );
}

function normalizeTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
