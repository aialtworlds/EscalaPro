import { describe, expect, it } from "vitest";
import { checkShiftCompliance, evaluateShift, isHardBlock } from "@/lib/clt-rules";
import type { ComplianceProfile } from "@/lib/clt/params";
import type { RuleEmployee, RuleShift } from "@/lib/clt/types";

const emp = (profile?: ComplianceProfile, extra: Partial<RuleEmployee> = {}): RuleEmployee => ({
  id: "e1",
  name: "Teste",
  role_profile: "clt_regular",
  journey_hours: 8,
  compliance_profile: profile ?? null,
  ...extra,
});

const shift = (date: string, start: string, end: string, id = "s"): RuleShift => ({
  id,
  employee_id: "e1",
  shift_date: date,
  start_time: start,
  end_time: end,
});

const codes = (vs: { code: string }[]) => vs.map((v) => v.code);

describe("base federal", () => {
  it("aceita jornada padrão de 8h sem erro", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "08:00", "16:00"), emp(), []);
    expect(v.some((x) => x.level === "error")).toBe(false);
  });

  it("acusa interjornada abaixo de 11h", () => {
    const v = checkShiftCompliance(shift("2026-07-28", "06:00", "14:00", "b"), emp(), [
      shift("2026-07-27", "14:00", "22:00", "a"),
    ]);
    expect(codes(v)).toContain("interjornada");
    expect(isHardBlock(v)).toBe(true);
  });

  it("acusa sobreposição de turnos", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "10:00", "18:00", "b"), emp(), [
      shift("2026-07-27", "08:00", "16:00", "a"),
    ]);
    expect(codes(v)).toContain("sobreposicao");
  });

  it("marca hora extra acima da jornada e erro acima de 8h+2h", () => {
    const extra = checkShiftCompliance(shift("2026-07-27", "08:00", "17:00"), emp(), []);
    expect(codes(extra)).toContain("hora_extra");
    const estouro = checkShiftCompliance(shift("2026-07-27", "08:00", "19:30"), emp(), []);
    expect(codes(estouro)).toContain("jornada_extrapolada");
  });

  it("aceita exatamente 44h na semana e acusa acima disso", () => {
    const dias = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    const outros = dias.slice(0, 4).map((d, i) => shift(d, "08:00", "17:00", `x${i}`)); // 4 x 9h = 36h
    const ok = checkShiftCompliance(shift(dias[4], "08:00", "16:00", "novo"), emp(), outros); // +8h = 44h
    expect(codes(ok)).not.toContain("limite_semanal");
    const nok = checkShiftCompliance(shift(dias[4], "08:00", "17:00", "novo"), emp(), outros); // 45h
    expect(codes(nok)).toContain("limite_semanal");
  });

  it("acusa 7 dias seguidos sem DSR", () => {
    const outros = Array.from({ length: 6 }, (_, i) =>
      shift(`2026-07-${20 + i}`, "08:00", "12:00", `d${i}`),
    );
    const v = checkShiftCompliance(shift("2026-07-26", "08:00", "12:00", "novo"), emp(), outros);
    expect(codes(v)).toContain("dsr");
  });

  it("calcula corretamente turno que vira a meia-noite", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "22:00", "06:00"), emp(), []);
    expect(codes(v)).toContain("noturno");
    expect(codes(v)).not.toContain("jornada_extrapolada"); // 8h exatas
  });

  it("freelancer sem vínculo não gera violação", () => {
    const r = evaluateShift(shift("2026-07-27", "08:00", "23:00"), null, []);
    expect(r.violations).toHaveLength(0);
  });
});

describe("escala 12x36", () => {
  const p12: ComplianceProfile = { regime: "escala_12x36", has_written_agreement: true };

  it("aceita 12h de jornada sem acusar hora extra", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "07:00", "19:00"), emp(p12), []);
    expect(codes(v)).not.toContain("hora_extra");
    expect(codes(v)).not.toContain("jornada_extrapolada");
  });

  it("acusa descanso menor que 36h", () => {
    const v = checkShiftCompliance(shift("2026-07-28", "07:00", "19:00", "b"), emp(p12), [
      shift("2026-07-27", "07:00", "19:00", "a"),
    ]);
    expect(codes(v)).toContain("interjornada");
  });

  it("aceita o dia seguinte de folga (36h de descanso)", () => {
    const v = checkShiftCompliance(shift("2026-07-29", "07:00", "19:00", "b"), emp(p12), [
      shift("2026-07-27", "07:00", "19:00", "a"),
    ]);
    expect(codes(v)).not.toContain("interjornada");
  });

  it("avisa quando falta o acordo escrito", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "07:00", "19:00"), emp({ regime: "escala_12x36" }), []);
    expect(codes(v)).toContain("acordo_ausente");
  });
});

describe("estágio", () => {
  const est: ComplianceProfile = { regime: "estagio" };
  const estagiario = () => emp(est, { role_profile: "estagiario", journey_hours: 6 });

  it("acusa jornada acima de 6h", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "08:00", "15:00"), estagiario(), []);
    expect(codes(v)).toContain("jornada_extrapolada");
  });

  it("acusa noturno", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "18:00", "23:00"), estagiario(), []);
    expect(codes(v)).toContain("estagio_noturno");
  });

  it("acusa semana acima de 30h", () => {
    const outros = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"].map((d, i) =>
      shift(d, "08:00", "14:00", `e${i}`),
    );
    const v = checkShiftCompliance(shift("2026-08-01", "08:00", "12:00", "novo"), estagiario(), outros);
    expect(codes(v)).toContain("limite_semanal");
  });
});

describe("cascata de parâmetros", () => {
  it("convenção vigente sobrescreve a base federal e é citada", () => {
    const profile: ComplianceProfile = {
      regime: "padrao_5x2",
      agreement: {
        name: "CCT SINDITESTE 2026/2027",
        valid_from: "2026-01-01",
        valid_to: "2026-12-31",
        confirmed: true,
        params: { weeklyHours: 40 },
      },
    };
    const outros = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"].map((d, i) =>
      shift(d, "08:00", "18:00", `c${i}`),
    ); // 40h
    const v = checkShiftCompliance(shift("2026-07-31", "08:00", "12:00", "novo"), emp(profile), outros);
    const semanal = v.find((x) => x.code === "limite_semanal");
    expect(semanal?.basis).toBe("CCT SINDITESTE 2026/2027");
    expect(semanal?.source).toBe("convencao");
    expect(semanal?.overridable).toBe(true);
  });

  it("convenção vencida volta à base federal e avisa", () => {
    const profile: ComplianceProfile = {
      regime: "padrao_5x2",
      agreement: {
        name: "CCT antiga",
        valid_from: "2024-01-01",
        valid_to: "2024-12-31",
        confirmed: true,
        params: { weeklyHours: 40 },
      },
    };
    const r = evaluateShift(shift("2026-07-27", "08:00", "16:00"), emp(profile), []);
    expect(r.configWarnings.join()).toContain("não está vigente");
  });

  it("convenção não confirmada não é aplicada", () => {
    const profile: ComplianceProfile = {
      regime: "padrao_5x2",
      agreement: { name: "CCT rascunho", confirmed: false, params: { journeyHours: 6 } },
    };
    const r = evaluateShift(shift("2026-07-27", "08:00", "16:00"), emp(profile), []);
    expect(r.configWarnings.join()).toContain("não foi confirmada");
    expect(r.violations.map((v) => v.code)).not.toContain("hora_extra");
  });

  it("violação federal cogente não é liberável", () => {
    const v = checkShiftCompliance(shift("2026-07-28", "06:00", "14:00", "b"), emp(), [
      shift("2026-07-27", "14:00", "22:00", "a"),
    ]);
    expect(v.find((x) => x.code === "interjornada")?.overridable).toBe(false);
  });

  it("liberação registrada some da lista quando permitida", () => {
    const semOverride = checkShiftCompliance(shift("2026-07-27", "08:00", "17:00"), emp(), []);
    expect(codes(semOverride)).toContain("hora_extra");
    const comOverride = checkShiftCompliance(shift("2026-07-27", "08:00", "17:00"), emp(), [], {
      overrides: { hora_extra: "Pico de demanda, compensação na sexta." },
    });
    expect(codes(comOverride)).not.toContain("hora_extra");
  });
});

describe("feriados", () => {
  it("sinaliza trabalho em feriado cadastrado", () => {
    const v = checkShiftCompliance(shift("2026-07-27", "08:00", "16:00"), emp(), [], {
      holidays: [{ holiday_date: "2026-07-27", name: "Aniversário da cidade", scope: "municipal" }],
    });
    expect(codes(v)).toContain("feriado");
  });
});
