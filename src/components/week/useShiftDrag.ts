// Arrastar-e-soltar por toque/mouse nas matrizes de escala.
//
// Dois tipos de arraste:
//  - turno: mover/trocar um turno entre dias e colaboradores;
//  - colaborador: soltar o nome numa célula para alocação rápida.
//
// Cada célula alvo precisa expor data-cell="<empIdOuFreela>|<YYYY-MM-DD>" e,
// quando ocupada, data-shift-id.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { assignEmployeeToCell, moveShift } from "@/lib/shifts.functions";

type Target = { employeeId: string | null; date: string; shiftId: string | null };
type Drag = { kind: "shift" | "employee"; id: string; label?: string };

function readTarget(x: number, y: number): Target | null {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest<HTMLElement>("[data-cell]");
  if (!cell) return null;
  const [emp, date] = (cell.dataset["cell"] ?? "").split("|");
  if (!date) return null;
  return {
    employeeId: emp && emp !== "freela" ? emp : null,
    date,
    shiftId: cell.dataset["shiftId"] || null,
  };
}

export function useShiftDrag() {
  const move = useServerFn(moveShift);
  const assign = useServerFn(assignEmployeeToCell);
  const qc = useQueryClient();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["shifts"] });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir");

  const moveM = useMutation({
    mutationFn: (v: { id: string; employee_id: string | null; shift_date: string; swap_with?: string | null }) =>
      move({ data: v }),
    onSuccess: (r) => {
      toast.success(r.swapped ? "Turnos trocados" : "Turno movido");
      invalidate();
    },
    onError: fail,
  });

  const assignM = useMutation({
    mutationFn: (v: { employee_id: string; shift_date: string; target_shift_id?: string | null }) =>
      assign({ data: v }),
    onSuccess: (r) => {
      toast.success(r.mode === "reassigned" ? "Turno realocado" : "Turno criado");
      invalidate();
    },
    onError: fail,
  });

  const begin = useCallback((e: React.PointerEvent, d: Drag) => {
    e.preventDefault();
    dragRef.current = d;
    setDrag(d);
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent, shiftId: string) => begin(e, { kind: "shift", id: shiftId }),
    [begin],
  );
  const startEmployeeDrag = useCallback(
    (e: React.PointerEvent, employeeId: string, label?: string) =>
      begin(e, { kind: "employee", id: employeeId, label }),
    [begin],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const t = readTarget(e.clientX, e.clientY);
      setHoverKey(t ? `${t.employeeId ?? "freela"}|${t.date}` : null);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      const t = readTarget(e.clientX, e.clientY);
      dragRef.current = null;
      setDrag(null);
      setHoverKey(null);
      setPos(null);
      if (!d || !t) return;
      if (d.kind === "shift") {
        if (t.shiftId === d.id) return;
        moveShiftTo(d.id, t);
      } else {
        // Alocação rápida: o alvo define o dia; a linha do próprio colaborador
        // cria/atualiza o turno dele, outra linha realoca o turno de lá.
        if (t.employeeId === d.id && !t.shiftId) {
          assignM.mutate({ employee_id: d.id, shift_date: t.date });
        } else if (t.shiftId) {
          assignM.mutate({ employee_id: d.id, shift_date: t.date, target_shift_id: t.shiftId });
        } else {
          assignM.mutate({ employee_id: d.id, shift_date: t.date });
        }
      }
    };
    const moveShiftTo = (id: string, t: Target) =>
      moveM.mutate({ id, employee_id: t.employeeId, shift_date: t.date, swap_with: t.shiftId });

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    const prev = document.body.style.touchAction;
    document.body.style.touchAction = "none";
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.body.style.touchAction = prev;
    };
  }, [drag, moveM, assignM]);

  return {
    dragId: drag?.kind === "shift" ? drag.id : null,
    dragEmployeeId: drag?.kind === "employee" ? drag.id : null,
    dragLabel: drag?.label ?? null,
    active: !!drag,
    hoverKey,
    pos,
    startDrag,
    startEmployeeDrag,
    isSaving: moveM.isPending || assignM.isPending,
  };
}
