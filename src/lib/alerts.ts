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

/** Turno cadastrado do setor (demand_templates): a demanda é POR TURNO. */
export type DemandRow = {
  id: string;
  sector_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  headcount: number;
  label?: string | null;
};

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** Janela em minutos, tratando virada de meia-noite (15:30–00:20 = 530 min). */
const window_ = (start: string, end: string) => {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return { s, e };
};

const hhmm = (t: string) => t.slice(0, 5);

export function computeAlerts(
  shifts: ShiftRow[],
  employees: EmployeeRow[],
  sectors: SectorRow[],
  demands: DemandRow[] = [],
  weekday?: number,
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

  // 2. Cobertura POR TURNO: cada turno cadastrado do setor precisa do seu
  // mínimo de pessoas. Um colaborador escalado na manhã não cobre a noite.
  const todaysDemands = weekday === undefined ? [] : demands.filter((d) => d.weekday === weekday);
  const active = shifts.filter((s) => s.status !== "absent");

  for (const d of todaysDemands) {
    const win = window_(d.start_time, d.end_time);
    const covering = active.filter((s) => {
      if ((s.sector_id ?? null) !== (d.sector_id ?? null)) return false;
      const w = window_(s.start_time, s.end_time);
      return w.s <= win.s && w.e >= win.e;
    }).length;
    if (covering < d.headcount) {
      const sectorName = sectors.find((x) => x.id === d.sector_id)?.name;
      const turno = d.label ? `${d.label} (${hhmm(d.start_time)}–${hhmm(d.end_time)})` : `${hhmm(d.start_time)}–${hhmm(d.end_time)}`;
      alerts.push({
        id: `demand-${d.id}`,
        level: covering === 0 ? "critical" : "warning",
        title: covering === 0 ? "Turno sem ninguém" : "Turno abaixo do mínimo",
        detail: `${sectorName ? `${sectorName} · ` : ""}${turno} exige ${d.headcount} pessoa(s) e tem ${covering}.`,
      });
    }
  }

  // Setor sem nenhum turno ativo — só quando não há turnos cadastrados para
  // hoje (com turnos cadastrados, os alertas acima já são mais precisos).
  const activeSectorIds = new Set(active.map((s) => s.sector_id));
  for (const sec of sectors) {
    if (todaysDemands.some((d) => d.sector_id === sec.id)) continue;
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
