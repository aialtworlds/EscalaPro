import { describe, expect, it } from "vitest";
import { addDays, formatDatePt, mondayOf, todayISO } from "@/lib/date-utils";

describe("todayISO — fuso da operação", () => {
  it("não pula de dia às 23h BRT (02h UTC do dia seguinte)", () => {
    const at23hBRT = new Date("2026-07-27T02:00:00Z"); // 23h de 26/07 em São Paulo
    expect(todayISO(at23hBRT)).toBe("2026-07-26");
  });

  it("vira o dia à meia-noite BRT (03h UTC)", () => {
    expect(todayISO(new Date("2026-07-27T03:00:00Z"))).toBe("2026-07-27");
  });

  it("é estável ao meio-dia", () => {
    expect(todayISO(new Date("2026-07-27T15:00:00Z"))).toBe("2026-07-27");
  });
});

describe("aritmética de datas", () => {
  it("mondayOf resolve a segunda da semana, inclusive no domingo", () => {
    expect(mondayOf("2026-07-27")).toBe("2026-07-27"); // segunda
    expect(mondayOf("2026-08-02")).toBe("2026-07-27"); // domingo
    expect(mondayOf("2026-07-31")).toBe("2026-07-27");
  });

  it("addDays atravessa mês e ano sem deslocar por horário de verão", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-18", 1)).toBe("2026-10-19"); // janela histórica de DST
    expect(addDays("2026-02-01", -1)).toBe("2026-01-31");
  });

  it("formatDatePt usa o dia civil, não o horário local", () => {
    expect(formatDatePt("2026-07-27")).toBe("Segunda, 27/07");
  });
});
