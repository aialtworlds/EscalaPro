// Client-side operational alert derivation for the daily feed.
export type Alert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

type ShiftRow = {
  id: string;
  status: string;
  employee_id: string | null;
  sector_id: string | null;
  start_time: string;
  end_time: string;
  is_freelancer: boolean;
  employees?: { name?: string } | null;
  sectors?: { name?: string } | null;
  freelancer_label?: string | null;
};

type EmployeeRow = { id: string; name: string; sector_id: string | null };
type SectorRow = { id: string; name: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function computeAlerts(
  shifts: ShiftRow[],
  employees: EmployeeRow[],
  sectors: SectorRow[],
): Alert[] {
  const alerts: Alert[] = [];

  // 1. Absences without replacement coverage in the same sector.
  const absent = shifts.filter((s) => s.status === "absent");
  for (const a of absent) {
    const covered = shifts.some(
      (s) =>
        s.id !== a.id &&
        s.status !== "absent" &&
        (s.is_freelancer || s.employee_id !== a.employee_id) &&
        s.sector_id === a.sector_id &&
        toMin(s.start_time) <= toMin(a.start_time) + 60 &&
        toMin(s.end_time) >= toMin(a.end_time) - 60,
    );
    if (!covered) {
      alerts.push({
        id: `uncovered-${a.id}`,
        level: "critical",
        title: "Falta sem cobertura",
        detail: `${a.employees?.name ?? a.freelancer_label ?? "Colaborador"} faltou${a.sectors?.name ? ` em ${a.sectors.name}` : ""} e ninguém cobre o turno.`,
      });
    }
  }

  // 2. Sectors with no active shift today.
  const activeSectorIds = new Set(shifts.filter((s) => s.status !== "absent").map((s) => s.sector_id));
  for (const sec of sectors) {
    if (!activeSectorIds.has(sec.id)) {
      alerts.push({
        id: `empty-sector-${sec.id}`,
        level: "warning",
        title: "Setor sem escala",
        detail: `${sec.name} não tem nenhum turno ativo hoje.`,
      });
    }
  }

  // 3. Registered employees with no shift today.
  const scheduledIds = new Set(shifts.map((s) => s.employee_id).filter(Boolean));
  const idle = employees.filter((e) => !scheduledIds.has(e.id));
  if (idle.length) {
    alerts.push({
      id: "idle-employees",
      level: "info",
      title: `${idle.length} sem turno hoje`,
      detail: idle.slice(0, 4).map((e) => e.name).join(", ") + (idle.length > 4 ? "…" : ""),
    });
  }

  // 4. Overlapping shifts for the same employee.
  const byEmployee = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    if (!s.employee_id) continue;
    byEmployee.set(s.employee_id, [...(byEmployee.get(s.employee_id) ?? []), s]);
  }
  for (const [, list] of byEmployee) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      if (toMin(sorted[i].start_time) < toMin(sorted[i - 1].end_time)) {
        alerts.push({
          id: `overlap-${sorted[i].id}`,
          level: "warning",
          title: "Turnos sobrepostos",
          detail: `${sorted[i].employees?.name ?? "Colaborador"} tem dois turnos no mesmo horário.`,
        });
        break;
      }
    }
  }

  return alerts;
}
