// Relatório mensal: horas, extras, faltas e alertas de conformidade por colaborador.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toRuleEmployee } from "@/lib/clt/map";
import { evaluateShift, durationMinutes } from "@/lib/clt-rules";
import type { RuleShift } from "@/lib/clt-rules";
import { monthBounds, type EmployeeReport } from "@/lib/report";

export const monthlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { from, to } = monthBounds(data.month);
    const sb = context.supabase;

    const [employeesRes, shiftsRes, holidaysRes, overridesRes] = await Promise.all([
      sb.from("employees").select("*, sectors(name), compliance_profiles(*, agreements(*))").order("name"),
      sb.from("shifts").select("*").gte("shift_date", from).lte("shift_date", to).order("shift_date"),
      sb.from("holidays").select("holiday_date, name, scope").gte("holiday_date", from).lte("holiday_date", to),
      sb.from("compliance_overrides").select("shift_id, rule_code, justification"),
    ]);

    for (const r of [employeesRes, shiftsRes, holidaysRes, overridesRes]) {
      if (r.error) throw new Error(r.error.message);
    }

    const employees = employeesRes.data ?? [];
    const shifts = shiftsRes.data ?? [];
    const holidays = holidaysRes.data ?? [];
    const overridesByShift = new Map<string, Record<string, string>>();
    for (const o of overridesRes.data ?? []) {
      const cur = overridesByShift.get(o.shift_id) ?? {};
      cur[o.rule_code] = o.justification;
      overridesByShift.set(o.shift_id, cur);
    }

    const rows: EmployeeReport[] = employees.map((e) => {
      const rule = toRuleEmployee(e as never);
      const own = shifts.filter((s) => s.employee_id === e.id);
      const worked = own.filter((s) => s.status !== "absent") as unknown as RuleShift[];
      const journeyMin = Math.round(Number(e.journey_hours ?? 8) * 60);

      let minutes = 0;
      let extraMinutes = 0;
      const violations: EmployeeReport["violations"] = [];

      for (const s of own.filter((x) => x.status !== "absent")) {
        const shift = s as unknown as RuleShift;
        const dur = durationMinutes(shift);
        minutes += dur;
        if (s.is_extra) extraMinutes += dur;
        else if (dur > journeyMin) extraMinutes += dur - journeyMin;

        const res = evaluateShift(shift, rule, worked, {
          holidays,
          overrides: overridesByShift.get(s.id) ?? {},
        });
        for (const v of res.violations) {
          violations.push({ code: v.code, message: v.message, level: v.level, date: s.shift_date });
        }
      }

      return {
        employee_id: e.id,
        name: e.name,
        role_profile: e.role_profile,
        sector: (e as { sectors?: { name: string } | null }).sectors?.name ?? null,
        shifts: worked.length,
        minutes,
        extraMinutes,
        absences: own.filter((s) => s.status === "absent").length,
        violations,
      };
    });

    return {
      month: data.month,
      from,
      to,
      rows,
      totals: {
        shifts: rows.reduce((a, r) => a + r.shifts, 0),
        minutes: rows.reduce((a, r) => a + r.minutes, 0),
        extraMinutes: rows.reduce((a, r) => a + r.extraMinutes, 0),
        absences: rows.reduce((a, r) => a + r.absences, 0),
        violations: rows.reduce((a, r) => a + r.violations.length, 0),
        freelancerShifts: shifts.filter((s) => s.is_freelancer).length,
      },
    };
  });
