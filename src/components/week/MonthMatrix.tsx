// Matriz mensal: colaboradores × todos os dias do mês.
//
// Reaproveita a consulta semanal já existente — busca as semanas que cobrem o
// mês e monta uma única grade rolável, com exportação CSV do mês fechado.
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { listShiftsByWeek } from "@/lib/shifts.functions";
import { listEmployees } from "@/lib/employees.functions";
import { addDays, mondayOf, trimTime, WEEKDAY_LABELS, weekdayOf } from "@/lib/date-utils";
import { monthBounds, monthLabel, shiftMonth } from "@/lib/report";
import { useShiftDrag } from "@/components/week/useShiftDrag";

type Shift = {
  id: string;
  employee_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  freelancer_label?: string | null;
};

/** Dias do mês em ISO. */
function monthDays(month: string) {
  const { from, to } = monthBounds(month);
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Segundas-feiras que cobrem o mês inteiro. */
function weeksCovering(month: string) {
  const { to } = monthBounds(month);
  const out: string[] = [];
  for (let w = mondayOf(`${month}-01`); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

export function MonthMatrix({
  month,
  onMonthChange,
}: {
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const drag = useShiftDrag();
  const shiftsFn = useServerFn(listShiftsByWeek);
  const empsFn = useServerFn(listEmployees);

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });
  const weeks = weeksCovering(month);
  const weekQueries = useQueries({
    queries: weeks.map((w) => ({
      queryKey: ["shifts", "week", w],
      queryFn: () => shiftsFn({ data: { week_start: w } }),
    })),
  });

  const days = monthDays(month);
  const loading = weekQueries.some((q) => q.isPending);
  const shifts = weekQueries
    .flatMap((q) => (q.data ?? []) as Shift[])
    .filter((s) => days.includes(s.shift_date));

  const cell = (empId: string, day: string) =>
    shifts.find((s) => s.employee_id === empId && s.shift_date === day);

  function exportCsv() {
    const header = ["Colaborador", ...days.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`)];
    const rows = (employees.data ?? []).map((emp) => [
      emp.name,
      ...days.map((d) => {
        const s = cell(emp.id, d);
        if (!s) return "";
        if (s.status === "absent") return "FALTA";
        return `${trimTime(s.start_time)}-${trimTime(s.end_time)}`;
      }),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `escala-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV do mês exportado");
  }

  const totalShifts = shifts.filter((s) => s.status !== "absent").length;

  return (
    <>
      <div className="px-4 pb-2 print:pt-0">
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-lg font-bold font-mono uppercase">{monthLabel(month)}</h1>
          <div className="flex gap-1 print:hidden">
            <Button size="icon" variant="outline" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Mês anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Próximo mês">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
          {loading ? "Carregando…" : `${totalShifts} turno(s) no mês`}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 print:hidden">
          Toque e arraste um turno para outro dia/colaborador — soltar sobre outro turno troca os dois.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-2 print:hidden">
          <Button size="sm" variant="outline" className="text-xs" onClick={exportCsv}>
            <Download className="size-3.5 mr-1" /> CSV do mês
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="px-4">
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th className="p-2 text-left border-r border-border sticky left-0 bg-secondary z-10 min-w-[100px]">Colab.</th>
                {days.map((d) => {
                  const wd = weekdayOf(d);
                  return (
                    <th
                      key={d}
                      className={`p-1 text-center border-r border-border last:border-r-0 min-w-[38px] ${
                        wd === 0 || wd === 6 ? "text-primary" : ""
                      }`}
                    >
                      <div className="text-[9px] font-bold">{WEEKDAY_LABELS[wd]}</div>
                      <div className="text-[9px] font-mono text-muted-foreground">{d.slice(8, 10)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.data?.map((emp) => (
                <tr key={emp.id} className="border-t border-border">
                  <td
                    onPointerDown={(e) => drag.startEmployeeDrag(e, emp.id, emp.name)}
                    className={`p-2 font-medium border-r border-border sticky left-0 bg-card z-10 truncate max-w-[100px] cursor-grab touch-none select-none ${
                      drag.dragEmployeeId === emp.id ? "text-primary" : ""
                    }`}
                    title="Arraste o nome para alocar em um dia"
                  >
                    {emp.name}
                  </td>
                  {days.map((d) => {
                    const s = cell(emp.id, d);
                    const key = `${emp.id}|${d}`;
                    return (
                      <td
                        key={d}
                        data-cell={key}
                        data-shift-id={s?.id ?? ""}
                        className={`p-0.5 text-center border-r border-border last:border-r-0 ${
                          drag.hoverKey === key && drag.active ? "bg-primary/20 outline outline-1 outline-primary" : ""
                        }`}
                      >
                        {s ? (
                          <div
                            onPointerDown={(e) => drag.startDrag(e, s.id)}
                            className={`py-1 rounded text-[9px] font-mono font-bold cursor-grab touch-none select-none ${
                              drag.dragId === s.id ? "opacity-40" : ""
                            } ${
                              s.status === "absent"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
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
            </tbody>

          </table>
        </div>
        {!employees.data?.length && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhum colaborador cadastrado. Vá para Configurações.
          </p>
        )}
      </div>

      {drag.active && drag.pos ? (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold shadow-lg"
          style={{ left: drag.pos.x + 12, top: drag.pos.y - 12 }}
        >
          {drag.dragLabel ?? "Mover turno"}
        </div>
      ) : null}
    </>
  );
}

