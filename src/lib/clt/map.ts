// Converte linhas do banco em entradas do motor de conformidade.
// Client-safe: sem I/O, usado no feed e no servidor de cobertura.
import type { ComplianceProfile, ComplianceParams, WorkRegime } from "./params";
import type { RuleEmployee } from "./types";

type ProfileRow = {
  regime: string;
  has_written_agreement?: boolean | null;
  params?: unknown;
  agreements?: {
    name: string;
    valid_from?: string | null;
    valid_to?: string | null;
    confirmed?: boolean | null;
    params?: unknown;
  } | null;
};

const asParams = (v: unknown): Partial<ComplianceParams> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<ComplianceParams>) : null;

export function toComplianceProfile(row: ProfileRow | null | undefined): ComplianceProfile | null {
  if (!row) return null;
  return {
    regime: row.regime as WorkRegime,
    has_written_agreement: row.has_written_agreement ?? false,
    params: asParams(row.params),
    agreement: row.agreements
      ? {
          name: row.agreements.name,
          valid_from: row.agreements.valid_from ?? null,
          valid_to: row.agreements.valid_to ?? null,
          confirmed: row.agreements.confirmed ?? false,
          params: asParams(row.agreements.params),
        }
      : null,
  };
}

type EmployeeRow = {
  id: string;
  name?: string | null;
  role_profile: string;
  journey_hours?: number | string | null;
  compliance_profiles?: ProfileRow | null;
};

export function toRuleEmployee(row: EmployeeRow): RuleEmployee {
  return {
    id: row.id,
    name: row.name ?? undefined,
    role_profile: row.role_profile,
    journey_hours: row.journey_hours ?? null,
    compliance_profile:
      toComplianceProfile(row.compliance_profiles) ??
      // Compatibilidade: cadastro antigo sem perfil cai no regime equivalente.
      (row.role_profile === "estagiario" ? { regime: "estagio" } : null),
  };
}
