// Motor de conformidade trabalhista — orquestrador.
//
// Não há limite cravado aqui: os números vêm da cascata
// federal → regime → convenção (CCT/ACT) → acordo individual
// (ver src/lib/clt/params.ts e src/lib/clt/resolve.ts) e cada violação
// carrega a citação da norma e a procedência do parâmetro usado.
//
// Puro, sem I/O: roda igual no cliente (validação ao editar turno) e no
// servidor (filtro de candidatos à cobertura).

import { absSpan, durationMinutes, fmtHours } from "@/lib/clt/checks";
import { REGIME_CHECKS } from "@/lib/clt/regimes";
import { resolveParams } from "@/lib/clt/resolve";
import type { CheckInput, Holiday, RuleEmployee, RuleShift, Violation } from "@/lib/clt/types";

export type { RuleEmployee, RuleShift, Violation, Holiday, ViolationLevel } from "@/lib/clt/types";
export type { ComplianceParams, ComplianceProfile, WorkRegime } from "@/lib/clt/params";
export { REGIME_LABELS } from "@/lib/clt/params";
export { absSpan, durationMinutes, fmtHours } from "@/lib/clt/checks";
export { resolveParams } from "@/lib/clt/resolve";

export type ComplianceContext = {
  holidays?: Holiday[];
  /** Liberações já registradas: código da regra → justificativa. */
  overrides?: Record<string, string>;
};

export type ComplianceResult = {
  violations: Violation[];
  /** Avisos de configuração (convenção vencida, não confirmada). */
  configWarnings: string[];
  regime: string;
};

/**
 * Avalia um turno contra as demais escalas do colaborador na semana.
 * `others` deve conter os turnos da mesma semana (o próprio é ignorado).
 */
export function evaluateShift(
  candidate: RuleShift,
  employee: RuleEmployee | null | undefined,
  others: RuleShift[],
  ctx: ComplianceContext = {},
): ComplianceResult {
  if (!employee) {
    // Freelancer avulso: sem vínculo empregatício a validar.
    return { violations: [], configWarnings: [], regime: "sem_vinculo" };
  }

  const resolved = resolveParams(employee.compliance_profile ?? null, candidate.shift_date);

  // Jornada contratual do cadastro só entra quando não foi definida por
  // convenção/acordo — o cadastro é a camada menos específica das três.
  const contractual = Number(employee.journey_hours ?? NaN);
  if (
    resolved.sources.journeyHours.origin === "federal" &&
    Number.isFinite(contractual) &&
    contractual > 0 &&
    contractual < resolved.params.journeyHours
  ) {
    resolved.params.journeyHours = contractual;
    resolved.sources.journeyHours = { origin: "acordo", basis: "Jornada contratual do cadastro" };
  }

  const peers = others.filter(
    (o) => o.employee_id === candidate.employee_id && o.id !== candidate.id && o.status !== "absent",
  );

  const input: CheckInput = {
    candidate,
    peers,
    employee,
    resolved,
    dur: durationMinutes(candidate),
    span: absSpan(candidate),
    holidays: ctx.holidays ?? [],
  };

  const seen = new Set<string>();
  const violations: Violation[] = [];
  for (const check of REGIME_CHECKS[resolved.regime]) {
    for (const v of check(input)) {
      if (seen.has(v.code)) continue;
      seen.add(v.code);
      if (ctx.overrides?.[v.code] && v.overridable) continue; // liberado com justificativa registrada
      violations.push(v);
    }
  }

  return { violations, configWarnings: resolved.configWarnings, regime: resolved.regime };
}

/** Assinatura legada — mantida para os pontos que só precisam da lista. */
export function checkShiftCompliance(
  candidate: RuleShift,
  employee: RuleEmployee | null | undefined,
  others: RuleShift[],
  ctx: ComplianceContext = {},
): Violation[] {
  return evaluateShift(candidate, employee, others, ctx).violations;
}

export const worstLevel = (vs: Violation[]): "error" | "warn" | "info" | null =>
  vs.some((x) => x.level === "error") ? "error" : vs.some((x) => x.level === "warn") ? "warn" : vs.length ? "info" : null;

/** Bloqueia alocação apenas em violação de norma federal cogente. */
export const isHardBlock = (vs: Violation[]) => vs.some((v) => v.level === "error" && !v.overridable);

export const COMPLIANCE_DISCLAIMER =
  "Verificação automatizada de apoio, baseada na legislação federal e nos parâmetros cadastrados. Não substitui a convenção coletiva vigente nem parecer jurídico.";
