import { describe, expect, it } from "vitest";
import { buildWeekPlan, isBlocked, type AutoEmployee } from "../autofill";

const week = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]; // seg..dom

const emp = (id: string, name: string, sector: string | null = null): AutoEmployee => ({
  id, name, sector_id: sector, role_profile: "clt_regular", journey_hours: 8,
});

const demand = (weekday: number, headcount = 1, sector: string | null = null) => ({
  id: `d${weekday}`, sector_id: sector, weekday, start_time: "08:00", end_time: "16:00", headcount,
});

describe("buildWeekPlan", () => {
  it("aloca a demanda entre os colaboradores disponíveis", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(1), demand(2)],
      employees: [emp("a", "Ana"), emp("b", "Bruno")],
      constraints: [],
      existing: [],
    });
    expect(plan.planned).toHaveLength(2);
    expect(plan.gaps).toHaveLength(0);
  });

  it("distribui a carga: quem tem menos horas recebe o próximo turno", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(1), demand(2)],
      employees: [emp("a", "Ana"), emp("b", "Bruno")],
      constraints: [],
      existing: [],
    });
    const names = new Set(plan.planned.map((p) => p.employee_id));
    expect(names.size).toBe(2);
  });

  it("respeita indisponibilidade semanal de dia inteiro", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(1)],
      employees: [emp("a", "Ana")],
      constraints: [
        { employee_id: "a", kind: "indisponivel_semanal", weekday: 1, start_date: null, end_date: null, start_time: null, end_time: null },
      ],
      existing: [],
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.gaps).toHaveLength(1);
  });

  it("respeita afastamento por período", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(1)],
      employees: [emp("a", "Ana")],
      constraints: [
        { employee_id: "a", kind: "afastamento", weekday: null, start_date: "2026-07-25", end_date: "2026-07-30", start_time: null, end_time: null },
      ],
      existing: [],
    });
    expect(plan.gaps).toHaveLength(1);
  });

  it("não estoura 44h semanais", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(0), demand(1), demand(2), demand(3), demand(4), demand(5), demand(6)],
      employees: [emp("a", "Ana")],
      constraints: [],
      existing: [],
    });
    const minutes = plan.planned.length * 8 * 60;
    expect(minutes).toBeLessThanOrEqual(44 * 60);
    expect(plan.gaps.length).toBeGreaterThan(0);
  });

  it("considera turno já existente como cobertura", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(1, 1)],
      employees: [emp("a", "Ana")],
      constraints: [],
      existing: [{ employee_id: "a", shift_date: "2026-07-27", start_time: "08:00", end_time: "16:00" }],
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.gaps).toHaveLength(0);
  });

  it("prefere colaborador do setor da demanda", () => {
    const plan = buildWeekPlan({
      days: week,
      demands: [demand(1, 1, "s1")],
      employees: [emp("a", "Ana", "s2"), emp("b", "Bruno", "s1")],
      constraints: [],
      existing: [],
    });
    expect(plan.planned[0].employee_id).toBe("b");
  });
});

describe("isBlocked", () => {
  it("bloqueia só a faixa de horário informada", () => {
    const c = {
      employee_id: "a", kind: "indisponivel_semanal" as const, weekday: 1,
      start_date: null, end_date: null, start_time: "18:00", end_time: "23:00",
    };
    expect(isBlocked(c, "2026-07-27", "08:00", "16:00")).toBe(false);
    expect(isBlocked(c, "2026-07-27", "17:00", "22:00")).toBe(true);
  });
});

describe("separação por setor e limites individuais", () => {
  const base = {
    days: ["2026-01-05"], // segunda
    constraints: [],
    existing: [],
  };

  it("não aloca gente de outro setor em turno exclusivo", () => {
    const plan = buildWeekPlan({
      ...base,
      demands: [
        { id: "d1", sector_id: "cozinha", weekday: 1, start_time: "08:00", end_time: "16:00", headcount: 1, label: "Manhã", sector_only: true },
      ],
      employees: [
        { id: "e1", name: "Salão", sector_id: "salao", role_profile: "clt_regular", journey_hours: 8 },
      ],
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.gaps[0].reason).toContain("setor");
    expect(plan.gaps[0].label).toBe("Manhã");
  });

  it("aceita outro setor quando o turno é aberto", () => {
    const plan = buildWeekPlan({
      ...base,
      demands: [
        { id: "d1", sector_id: "cozinha", weekday: 1, start_time: "08:00", end_time: "16:00", headcount: 1, sector_only: false },
      ],
      employees: [
        { id: "e1", name: "Salão", sector_id: "salao", role_profile: "clt_regular", journey_hours: 8 },
      ],
    });
    expect(plan.planned).toHaveLength(1);
  });

  it("respeita a jornada individual do colaborador", () => {
    const plan = buildWeekPlan({
      ...base,
      demands: [
        { id: "d1", sector_id: null, weekday: 1, start_time: "08:00", end_time: "18:00", headcount: 1 },
      ],
      employees: [
        {
          id: "e1", name: "Estagiário", sector_id: null, role_profile: "estagiario", journey_hours: 6,
          limits: { journeyHours: 6, maxOvertimeHours: 0, weeklyHours: 30, interJourneyHours: 11, maxDaysPerWeek: 5 },
        },
      ],
    });
    expect(plan.planned).toHaveLength(0);
    expect(plan.gaps[0].reason).toContain("jornada");
  });
});
