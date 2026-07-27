import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, UserCheck } from "lucide-react";
import { suggestCoverage } from "@/lib/coverage.functions";
import { createShift } from "@/lib/shifts.functions";
import { CltPanel } from "@/components/CltBadge";
import { COMPLIANCE_DISCLAIMER } from "@/lib/clt-rules";
import { trimTime } from "@/lib/date-utils";

export function CoverageSheet({
  shift,
  onOpenChange,
  onAllocated,
}: {
  shift: any | null;
  onOpenChange: (o: boolean) => void;
  onAllocated: () => void;
}) {
  const suggestFn = useServerFn(suggestCoverage);
  const createFn = useServerFn(createShift);

  const q = useQuery({
    queryKey: ["coverage", shift?.id],
    enabled: !!shift,
    queryFn: () => suggestFn({ data: { shift_id: shift.id } }),
  });

  const allocate = useMutation({
    mutationFn: (employeeId: string) =>
      createFn({
        data: {
          employee_id: employeeId,
          sector_id: shift.sector_id,
          shift_date: shift.shift_date,
          start_time: trimTime(shift.start_time),
          end_time: trimTime(shift.end_time),
          is_freelancer: false,
          is_extra: true,
        },
      }),
    onSuccess: () => {
      toast.success("Cobertura alocada");
      onAllocated();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao alocar"),
  });

  const ranked = q.data?.ranked ?? [];
  const candidates = q.data?.candidates ?? [];
  const byId = (id: string) => candidates.find((c) => c.employee_id === id);
  const rest = candidates.filter((c) => !ranked.some((r) => r.employee_id === c.employee_id));

  return (
    <Sheet open={!!shift} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-[440px] mx-auto max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Sugestão de cobertura
          </SheetTitle>
          <SheetDescription>
            {shift && `${trimTime(shift.start_time)} — ${trimTime(shift.end_time)}`}
            {shift?.sectors?.name ? ` • ${shift.sectors.name}` : ""} — candidatos filtrados pelas normas aplicáveis (federal, convenção e acordo).
          </SheetDescription>
        </SheetHeader>

        {q.isLoading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
            <Loader2 className="size-4 animate-spin" /> Analisando escala e regras trabalhistas...
          </p>
        )}
        {q.isError && (
          <p className="text-xs text-destructive py-6">
            {q.error instanceof Error ? q.error.message : "Falha ao sugerir cobertura."}
          </p>
        )}

        {q.data && (
          <div className="space-y-4 mt-4">
            {ranked.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recomendados pela IA</p>
                {ranked.map((r, i) => {
                  const c = byId(r.employee_id);
                  if (!c) return null;
                  return (
                    <div key={r.employee_id} className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">
                            {i + 1}. {c.name}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {c.role_label} • {c.week_hours} na semana
                            {c.same_sector ? " • mesmo setor" : ""}
                          </p>
                        </div>
                        <Button size="sm" disabled={allocate.isPending} onClick={() => allocate.mutate(c.employee_id)}>
                          <UserCheck className="size-3.5 mr-1" /> Alocar
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{r.reason}</p>
                      {c.violations.length > 0 && <CltPanel violations={c.violations} showDisclaimer={false} />}
                    </div>
                  );
                })}
              </div>
            )}

            {rest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Demais colaboradores</p>
                {rest.map((c) => (
                  <div
                    key={c.employee_id}
                    className={`rounded-xl border p-3 space-y-2 ${c.blocked ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">
                          {c.role_label} • {c.week_hours} na semana
                          {c.same_sector ? " • mesmo setor" : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={c.blocked ? "outline" : "secondary"}
                        disabled={c.blocked || allocate.isPending}
                        onClick={() => allocate.mutate(c.employee_id)}
                      >
                        {c.blocked ? "Bloqueado" : "Alocar"}
                      </Button>
                    </div>
                    {c.violations.length > 0 && <CltPanel violations={c.violations} showDisclaimer={false} />}
                  </div>
                ))}
              </div>
            )}

            {candidates.length > 0 && (
              <p className="text-[9px] leading-snug text-muted-foreground/70">{COMPLIANCE_DISCLAIMER}</p>
            )}

            {!candidates.length && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhum colaborador cadastrado para cobrir este turno.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
