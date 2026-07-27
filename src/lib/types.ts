// Tipos de domínio derivados do schema do banco.
// Regra: nada de `any` nas telas — os joins usados em cada query viram tipos
// explícitos aqui e são reusados nos componentes.
import type { Database } from "@/integrations/supabase/types";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type ShiftRow = Row<"shifts">;
export type SectorRow = Row<"sectors">;
export type EmployeeRow = Row<"employees">;
export type HolidayRow = Row<"holidays">;
export type OverrideRow = Row<"compliance_overrides">;
export type AgreementRow = Row<"agreements">;
export type ComplianceProfileRow = Row<"compliance_profiles">;

/** shifts + joins de listShiftsByDay */
export type DayShift = ShiftRow & {
  employees: { name: string; role_profile: string } | null;
  sectors: { name: string } | null;
};

/** shifts + joins de listShiftsByWeek */
export type WeekShift = ShiftRow & {
  employees: { name: string } | null;
  sectors: { name: string } | null;
};

/** employees + joins de listEmployees */
export type EmployeeWithProfile = EmployeeRow & {
  sectors?: { name: string } | null;
  compliance_profiles?:
    | (ComplianceProfileRow & { agreements?: AgreementRow | null })
    | null;
};

/** Campos editáveis de um turno usados na pré-visualização de conformidade. */
export type ShiftPatch = Partial<Pick<ShiftRow, "start_time" | "end_time" | "shift_date" | "sector_id">>;
