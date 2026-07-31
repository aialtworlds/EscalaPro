// Arrastar-e-soltar por toque/mouse nas matrizes de escala.
//
// Cada célula alvo precisa expor data-cell="<empIdOuFreela>|<YYYY-MM-DD>" e,
// quando ocupada, data-shift-id. O chip do turno chama startDrag(e, shiftId).
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { moveShift } from "@/lib/shifts.functions";

type Target = { employeeId: string | null; date: string; shiftId: string | null };

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
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<string | null>(null);

  const m = useMutation({
    mutationFn: (v: { id: string; employee_id: string | null; shift_date: string; swap_with?: string | null }) =>
      move({ data: v }),
    onSuccess: (r) => {
      toast.success(r.swapped ? "Turnos trocados" : "Turno movido");
      qc.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível mover"),
  });

  const startDrag = useCallback((e: React.PointerEvent, shiftId: string) => {
    e.preventDefault();
    dragRef.current = shiftId;
    setDragId(shiftId);
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const t = readTarget(e.clientX, e.clientY);
      setHoverKey(t ? `${t.employeeId ?? "freela"}|${t.date}` : null);
    };
    const onUp = (e: PointerEvent) => {
      const id = dragRef.current;
      const t = readTarget(e.clientX, e.clientY);
      dragRef.current = null;
      setDragId(null);
      setHoverKey(null);
      setPos(null);
      if (!id || !t || t.shiftId === id) return;
      m.mutate({
        id,
        employee_id: t.employeeId,
        shift_date: t.date,
        swap_with: t.shiftId,
      });
    };
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
  }, [dragId, m]);

  return { dragId, hoverKey, pos, startDrag, isSaving: m.isPending };
}
