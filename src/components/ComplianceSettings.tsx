import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ScrollText, CalendarDays, Layers, ChevronDown } from "lucide-react";
import {
  listAgreements,
  upsertAgreement,
  deleteAgreement,
  listComplianceProfiles,
  upsertComplianceProfile,
  deleteComplianceProfile,
  setEmployeeProfile,
  listHolidays,
  createHoliday,
  importNationalHolidays,
  deleteHoliday,
} from "@/lib/compliance.functions";
import { listEmployees } from "@/lib/employees.functions";
import { REGIME_LABELS, FEDERAL_PARAMS } from "@/lib/clt/params";
import type { WorkRegime } from "@/lib/clt/params";
import { COMPLIANCE_DISCLAIMER } from "@/lib/clt-rules";
import { formatDatePt, hoursToHHMM, hhmmToHours } from "@/lib/date-utils";
import { HhmmInput } from "@/components/HhmmInput";


const NONE = "__none__";

/** Campos editáveis de parâmetro (os demais seguem sempre a base federal). */
const PARAM_FIELDS: { key: keyof typeof FEDERAL_PARAMS; label: string; kind: "hhmm" | "int" }[] = [
  { key: "journeyHours", label: "Jornada diária (HH:MM)", kind: "hhmm" },
  { key: "weeklyHours", label: "Teto semanal (HH:MM)", kind: "hhmm" },
  { key: "maxOvertimeHours", label: "Extras/dia (HH:MM)", kind: "hhmm" },
  { key: "interJourneyHours", label: "Interjornada (HH:MM)", kind: "hhmm" },
  { key: "mealBreakMinutes", label: "Refeição (min)", kind: "int" },
  { key: "maxConsecutiveDays", label: "Dias seguidos máx.", kind: "int" },
];

type Params = Record<string, number>;

function ParamGrid({ value, onChange }: { value: Params; onChange: (p: Params) => void }) {
  const set = (key: string, v: number | null) => {
    const next = { ...value };
    if (v === null) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {PARAM_FIELDS.map((f) => (
        <div key={f.key}>
          <Label className="text-[10px]">{f.label}</Label>
          {f.kind === "hhmm" ? (
            <HhmmInput
              placeholder={hoursToHHMM(FEDERAL_PARAMS[f.key] as number)}
              value={value[f.key] !== undefined ? hoursToHHMM(value[f.key]) : ""}
              onChange={(v) => set(f.key, v ? hhmmToHours(v) : null)}
            />
          ) : (
            <Input
              type="text"
              inputMode="numeric"
              className="font-mono"
              placeholder={String(FEDERAL_PARAMS[f.key])}
              value={value[f.key] ?? ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                set(f.key, raw === "" ? null : Number(raw));
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}


function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  icon: typeof Layers;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        <Icon className="size-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronDown className={`size-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-3 pt-0 space-y-3">{children}</div>}
    </div>
  );
}

export function ComplianceSettings() {
  const qc = useQueryClient();
  const agreementsFn = useServerFn(listAgreements);
  const saveAgreementFn = useServerFn(upsertAgreement);
  const delAgreementFn = useServerFn(deleteAgreement);
  const profilesFn = useServerFn(listComplianceProfiles);
  const saveProfileFn = useServerFn(upsertComplianceProfile);
  const delProfileFn = useServerFn(deleteComplianceProfile);
  const setEmpProfileFn = useServerFn(setEmployeeProfile);
  const holidaysFn = useServerFn(listHolidays);
  const empsFn = useServerFn(listEmployees);
  const createHolidayFn = useServerFn(createHoliday);
  const importHolidaysFn = useServerFn(importNationalHolidays);
  const delHolidayFn = useServerFn(deleteHoliday);

  const agreements = useQuery({ queryKey: ["agreements"], queryFn: () => agreementsFn() });
  const profiles = useQuery({ queryKey: ["compliance-profiles"], queryFn: () => profilesFn() });
  const holidays = useQuery({ queryKey: ["holidays"], queryFn: () => holidaysFn() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });

  // ------------------------------------------------------------- convenções
  const [agr, setAgr] = useState({
    name: "",
    union_name: "",
    category: "",
    state_uf: "",
    city: "",
    valid_from: new Date().toISOString().slice(0, 10),
    valid_to: "",
  });
  const [agrParams, setAgrParams] = useState<Params>({});

  const saveAgreement = useMutation({
    mutationFn: () =>
      saveAgreementFn({
        data: {
          name: agr.name,
          union_name: agr.union_name || null,
          category: agr.category || null,
          state_uf: agr.state_uf ? agr.state_uf.toUpperCase() : null,
          city: agr.city || null,
          valid_from: agr.valid_from,
          valid_to: agr.valid_to || null,
          params: agrParams,
          source: "manual",
          confirmed: true,
        },
      }),
    onSuccess: () => {
      toast.success("Convenção registrada");
      setAgr({ ...agr, name: "", union_name: "", category: "", city: "" });
      setAgrParams({});
      qc.invalidateQueries({ queryKey: ["agreements"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  // ---------------------------------------------------------------- perfis
  const [prof, setProf] = useState({ name: "", regime: "padrao_5x2" as WorkRegime, agreement_id: NONE, has_written_agreement: false });
  const [profParams, setProfParams] = useState<Params>({});

  const saveProfile = useMutation({
    mutationFn: () =>
      saveProfileFn({
        data: {
          name: prof.name,
          regime: prof.regime,
          agreement_id: prof.agreement_id === NONE ? null : prof.agreement_id,
          has_written_agreement: prof.has_written_agreement,
          params: profParams,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil de jornada salvo");
      setProf({ name: "", regime: "padrao_5x2", agreement_id: NONE, has_written_agreement: false });
      setProfParams({});
      qc.invalidateQueries({ queryKey: ["compliance-profiles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const assign = useMutation({
    mutationFn: (v: { employee_id: string; compliance_profile_id: string | null }) => setEmpProfileFn({ data: v }),
    onSuccess: () => {
      toast.success("Perfil aplicado ao colaborador");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  // -------------------------------------------------------------- feriados
  const [hol, setHol] = useState({ name: "", holiday_date: new Date().toISOString().slice(0, 10), scope: "municipal" as "nacional" | "estadual" | "municipal" });
  const year = new Date().getFullYear();
  const addHoliday = useMutation({
    mutationFn: () => createHolidayFn({ data: { name: hol.name, holiday_date: hol.holiday_date, scope: hol.scope } }),
    onSuccess: () => { toast.success("Feriado adicionado"); setHol({ ...hol, name: "" }); qc.invalidateQueries({ queryKey: ["holidays"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const importHolidays = useMutation({
    mutationFn: (y: number) => importHolidaysFn({ data: { year: y } }),
    onSuccess: (r: any) => { toast.success(`${r?.inserted ?? 0} feriados nacionais importados`); qc.invalidateQueries({ queryKey: ["holidays"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <section className="px-4 mt-6 space-y-3">
      <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">3. Conformidade Trabalhista</h2>

      <Section
        icon={ScrollText}
        title="Convenções e acordos coletivos"
        subtitle={`${agreements.data?.length ?? 0} registrada(s) — sobrepõem a base federal`}
      >
        <div className="space-y-2">
          <Input placeholder="Nome (ex: CCT Comércio 2026)" value={agr.name} onChange={(e) => setAgr({ ...agr, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Sindicato" value={agr.union_name} onChange={(e) => setAgr({ ...agr, union_name: e.target.value })} />
            <Input placeholder="Categoria" value={agr.category} onChange={(e) => setAgr({ ...agr, category: e.target.value })} />
            <Input placeholder="UF" maxLength={2} value={agr.state_uf} onChange={(e) => setAgr({ ...agr, state_uf: e.target.value })} />
            <Input placeholder="Município" value={agr.city} onChange={(e) => setAgr({ ...agr, city: e.target.value })} />
            <div>
              <Label className="text-[10px]">Vigência de</Label>
              <Input type="date" value={agr.valid_from} onChange={(e) => setAgr({ ...agr, valid_from: e.target.value })} className="font-mono" />
            </div>
            <div>
              <Label className="text-[10px]">Até</Label>
              <Input type="date" value={agr.valid_to} onChange={(e) => setAgr({ ...agr, valid_to: e.target.value })} className="font-mono" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Deixe em branco os parâmetros não tratados pela convenção — valem os federais.
          </p>
          <ParamGrid value={agrParams} onChange={setAgrParams} />
          <Button className="w-full" disabled={agr.name.length < 2 || saveAgreement.isPending} onClick={() => saveAgreement.mutate()}>
            Registrar convenção
          </Button>
        </div>

        <div className="space-y-2">
          {agreements.data?.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-2 border border-border rounded-lg p-2.5 bg-background">
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[a.union_name, a.category, a.city, a.state_uf].filter(Boolean).join(" • ") || "Sem abrangência informada"}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {formatDatePt(a.valid_from)} → {a.valid_to ? formatDatePt(a.valid_to) : "sem termo"}
                  {a.source === "ia" && !a.confirmed ? " • extraída por IA, pendente de conferência" : ""}
                </p>
              </div>
              <button
                onClick={() => confirm("Remover convenção?") && delAgreementFn({ data: { id: a.id } }).then(() => qc.invalidateQueries({ queryKey: ["agreements"] }))}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={Layers}
        title="Perfis de jornada"
        subtitle={`${profiles.data?.length ?? 0} perfil(is) — regime + convenção aplicados ao colaborador`}
      >
        <div className="space-y-2">
          <Input placeholder="Nome (ex: Portaria 12x36)" value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Regime</Label>
              <Select value={prof.regime} onValueChange={(v: WorkRegime) => setProf({ ...prof, regime: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGIME_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Convenção</Label>
              <Select value={prof.agreement_id} onValueChange={(v) => setProf({ ...prof, agreement_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Somente base federal</SelectItem>
                  {agreements.data?.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={prof.has_written_agreement}
              onChange={(e) => setProf({ ...prof, has_written_agreement: e.target.checked })}
              className="accent-primary size-3.5"
            />
            Existe acordo escrito registrado (exigido em 12x36 e afins)
          </label>
          <ParamGrid value={profParams} onChange={setProfParams} />
          <Button className="w-full" disabled={prof.name.length < 2 || saveProfile.isPending} onClick={() => saveProfile.mutate()}>
            Salvar perfil
          </Button>
        </div>

        <div className="space-y-2">
          {profiles.data?.map((p: any) => (
            <div key={p.id} className="flex items-start justify-between gap-2 border border-border rounded-lg p-2.5 bg-background">
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {REGIME_LABELS[p.regime as WorkRegime]} • {p.agreements?.name ?? "base federal"}
                  {p.has_written_agreement ? " • acordo escrito" : ""}
                </p>
              </div>
              <button
                onClick={() => confirm("Remover perfil?") && delProfileFn({ data: { id: p.id } }).then(() => qc.invalidateQueries({ queryKey: ["compliance-profiles"] }))}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Aplicar aos colaboradores</p>
          {employees.data?.map((e: any) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate">{e.name}</span>
              <Select
                value={e.compliance_profile_id ?? NONE}
                onValueChange={(v) => assign.mutate({ employee_id: e.id, compliance_profile_id: v === NONE ? null : v })}
              >
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Padrão federal</SelectItem>
                  {profiles.data?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={CalendarDays}
        title="Feriados"
        subtitle={`${holidays.data?.length ?? 0} cadastrado(s) — nacionais, estaduais e municipais`}
      >
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-xs" disabled={importHolidays.isPending} onClick={() => importHolidays.mutate(year)}>
            Importar nacionais {year}
          </Button>
          <Button variant="outline" className="flex-1 text-xs" disabled={importHolidays.isPending} onClick={() => importHolidays.mutate(year + 1)}>
            Importar {year + 1}
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input placeholder="Nome do feriado local" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} />
          <Input type="date" className="font-mono" value={hol.holiday_date} onChange={(e) => setHol({ ...hol, holiday_date: e.target.value })} />
          <Select value={hol.scope} onValueChange={(v: any) => setHol({ ...hol, scope: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nacional">Nacional</SelectItem>
              <SelectItem value="estadual">Estadual</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={hol.name.length < 2 || addHoliday.isPending} onClick={() => addHoliday.mutate()}>Adicionar</Button>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {holidays.data?.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between gap-2 border border-border rounded-lg px-2.5 py-1.5 bg-background">
              <span className="text-xs truncate">
                <span className="font-mono text-muted-foreground mr-2">{formatDatePt(h.holiday_date)}</span>
                {h.name}
              </span>
              <button
                onClick={() => delHolidayFn({ data: { id: h.id } }).then(() => qc.invalidateQueries({ queryKey: ["holidays"] }))}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-[9px] leading-snug text-muted-foreground/70">{COMPLIANCE_DISCLAIMER}</p>
    </section>
  );
}
