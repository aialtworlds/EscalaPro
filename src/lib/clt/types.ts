// Tipos compartilhados do motor de conformidade.
import type { ResolvedParams } from "./resolve";

export type RuleShift = {
  id?: string;
  employee_id: string | null;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM[:SS]
  end_time: string;
  status?: string;
  is_freelancer?: boolean;
};

export type RuleEmployee = {
  id: string;
  name?: string;
  role_profile: string; // clt_regular | estagiario | clt_mulher
  journey_hours?: number | string | null;
  /** Perfil de jornada (regime + convenção). Ausente = base federal padrão. */
  compliance_profile?: import("./params").ComplianceProfile | null;
};

export type ViolationLevel = "error" | "warn" | "info";

export type Violation = {
  code: string;
  level: ViolationLevel;
  message: string;
  /** Citação da norma que sustenta o alerta. */
  basis: string;
  /** De onde veio o parâmetro usado. */
  source: "federal" | "convencao" | "acordo";
  /** Pode ser liberado pelo gestor com justificativa registrada. */
  overridable: boolean;
};

export type Holiday = {
  holiday_date: string;
  name: string;
  scope?: string | null;
};

export type CheckInput = {
  candidate: RuleShift;
  peers: RuleShift[];
  employee: RuleEmployee;
  resolved: ResolvedParams;
  /** Duração do turno avaliado, em minutos. */
  dur: number;
  span: { start: number; end: number };
  holidays: Holiday[];
};

export type Check = (input: CheckInput) => Violation[];
