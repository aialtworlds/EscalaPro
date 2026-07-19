import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listShiftsByWeek } from "@/lib/shifts.functions";
import { listEmployees } from "@/lib/employees.functions";
import { mondayOf, addDays, todayISO, WEEKDAY_LABELS, trimTime } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/semana")({
  head: () => ({ meta: [{ title: "Planilha Semanal — EscalaPro OS" }, { name: "description", content: "Matriz semanal de escala." }] }),
  component: SemanaPage,
});

function SemanaPage() {
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const shiftsFn = useServerFn(listShiftsByWeek);
  const empsFn = useServerFn(listEmployees);
  const shifts = useQuery({ queryKey: ["shifts", "week", weekStart], queryFn: () => shiftsFn({ data: { week_start: weekStart } }) });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)} — ${days[6].slice(8, 10)}/${days[6].slice(5, 7)}`;

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Planilha Semanal</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-lg font-bold font-mono">{weekLabel}</h1>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th className="p-2 text-left border-r border-border sticky left-0 bg-secondary z-10 min-w-[100px]">Colab.</th>
                {days.map((d, i) => (
                  <th key={d} className="p-2 text-center border-r border-border last:border-r-0 min-w-[52px]">
                    <div className="font-bold">{WEEKDAY_LABELS[(i + 1) % 7]}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">{d.slice(8, 10)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.data?.map((emp) => (
                <tr key={emp.id} className="border-t border-border">
                  <td className="p-2 font-medium border-r border-border sticky left-0 bg-card z-10 truncate max-w-[100px]">
                    {emp.name}
                  </td>
                  {days.map((d) => {
                    const s = shifts.data?.find((x) => x.employee_id === emp.id && x.shift_date === d);
                    return (
                      <td key={d} className="p-1 text-center border-r border-border last:border-r-0">
                        {s ? (
                          <div className={`py-1 px-1 rounded text-[9px] font-mono font-bold ${
                            s.status === "absent" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
                          }`}>
                            {trimTime(s.start_time).slice(0, 5)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {shifts.data?.filter((s) => !s.employee_id).length ? (
                <tr className="border-t border-border">
                  <td className="p-2 font-medium border-r border-border sticky left-0 bg-card z-10 text-muted-foreground italic">
                    Freelancers
                  </td>
                  {days.map((d) => {
                    const count = shifts.data?.filter((x) => !x.employee_id && x.shift_date === d).length ?? 0;
                    return (
                      <td key={d} className="p-1 text-center border-r border-border last:border-r-0">
                        {count > 0 ? (
                          <div className="py-1 rounded text-[9px] font-mono font-bold bg-warning/15 text-warning-foreground">
                            +{count}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!employees.data?.length && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhum colaborador cadastrado. Vá para Configurações.
          </p>
        )}
      </div>

      <div className="px-4 mt-6 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Legenda</p>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="size-3 bg-primary/20 rounded" /> Turno</span>
          <span className="flex items-center gap-1"><span className="size-3 bg-destructive/20 rounded" /> Falta</span>
          <span className="flex items-center gap-1"><span className="size-3 bg-warning/20 rounded" /> Freelancer</span>
        </div>
      </div>
    </AppShell>
  );
}
