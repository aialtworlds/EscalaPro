import { describe, expect, it } from "vitest";
import { computeAlerts, type DemandRow } from "../alerts";

const sector = { id: "coz", name: "Cozinha" };
const MON = 1;

const shift = (over: Partial<Parameters<typeof computeAlerts>[0][number]> = {}) => ({
  id: crypto.randomUUID(),
  status: "scheduled",
  employee_id: "a",
  sector_id: "coz",
  start_time: "07:00:00",
  end_time: "15:00:00",
  is_freelancer: false,
  ...over,
});

const morning: DemandRow = {
  id: "m", sector_id: "coz", weekday: MON, start_time: "07:00:00", end_time: "15:00:00",
  headcount: 1, label: "Manhã",
};
const night: DemandRow = {
  id: "n", sector_id: "coz", weekday: MON, start_time: "15:30:00", end_time: "00:20:00",
  headcount: 1, label: "Noite",
};

describe("alertas de cobertura por turno", () => {
  it("acusa o turno da noite vazio mesmo com a manhã coberta", () => {
    const alerts = computeAlerts([shift()], [], [sector], [morning, night], MON);
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("demand-n");
    expect(ids).not.toContain("demand-m");
    expect(ids).not.toContain("empty-sector-coz");
  });

  it("não acusa nada quando os dois turnos estão cobertos", () => {
    const alerts = computeAlerts(
      [shift(), shift({ employee_id: "b", start_time: "15:30:00", end_time: "00:20:00" })],
      [],
      [sector],
      [morning, night],
      MON,
    );
    expect(alerts.filter((a) => a.id.startsWith("demand-"))).toHaveLength(0);
  });

  it("acusa turno abaixo do mínimo quando exige 2 e só tem 1", () => {
    const alerts = computeAlerts([shift()], [], [sector], [{ ...morning, headcount: 2 }], MON);
    const a = alerts.find((x) => x.id === "demand-m");
    expect(a?.level).toBe("warning");
    expect(a?.detail).toContain("exige 2 pessoa(s) e tem 1");
  });

  it("falta não conta como cobertura do turno", () => {
    const alerts = computeAlerts([shift({ status: "absent" })], [], [sector], [morning], MON);
    expect(alerts.find((x) => x.id === "demand-m")?.level).toBe("critical");
  });

  it("sem turnos cadastrados, mantém o alerta antigo de setor sem escala", () => {
    const alerts = computeAlerts([], [], [sector], [], MON);
    expect(alerts.map((a) => a.id)).toContain("empty-sector-coz");
  });
});
