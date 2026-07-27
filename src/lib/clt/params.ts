// Parâmetros de conformidade trabalhista.
// A base federal é embarcada e versionada; convenção (CCT/ACT) e acordo
// individual sobrescrevem valores em cascata. Todo parâmetro carrega a sua
// procedência para que a interface possa citar a fonte de cada número.

export type WorkRegime =
  | "padrao_5x2"
  | "padrao_6x1"
  | "escala_12x36"
  | "escala_24x72"
  | "estagio"
  | "parcial"
  | "intermitente";

export const REGIME_LABELS: Record<WorkRegime, string> = {
  padrao_5x2: "Padrão 5x2",
  padrao_6x1: "Padrão 6x1",
  escala_12x36: "Escala 12x36",
  escala_24x72: "Escala 24x72",
  estagio: "Estágio",
  parcial: "Jornada parcial",
  intermitente: "Intermitente",
};

/** Todos os números que o motor consulta. Nenhum limite fica cravado em regra. */
export type ComplianceParams = {
  /** Jornada diária contratual, em horas. */
  journeyHours: number;
  /** Teto semanal, em horas. */
  weeklyHours: number;
  /** Horas extras diárias permitidas acima da jornada. */
  maxOvertimeHours: number;
  /** Descanso mínimo entre duas jornadas, em horas. */
  interJourneyHours: number;
  /** Acima desta jornada exige-se o intervalo maior de refeição. */
  mealBreakAfterHours: number;
  /** Duração do intervalo de refeição, em minutos. */
  mealBreakMinutes: number;
  /** Acima desta jornada exige-se o intervalo curto. */
  shortBreakAfterHours: number;
  /** Duração do intervalo curto, em minutos. */
  shortBreakMinutes: number;
  /** Máximo de dias consecutivos de trabalho antes do DSR. */
  maxConsecutiveDays: number;
  /** Início da janela noturna, em minutos desde a meia-noite. */
  nightStartMinutes: number;
  /** Fim da janela noturna, em minutos desde a meia-noite. */
  nightEndMinutes: number;
  /** Exige acordo escrito registrado para o regime ser válido. */
  requiresWrittenAgreement: boolean;
};

export type ParamKey = keyof ComplianceParams;

export type ParamOrigin = "federal" | "convencao" | "acordo";

export type ParamSource = {
  origin: ParamOrigin;
  /** Citação legível: "CLT art. 66", "CCT SINDIFOZ 2025/2026". */
  basis: string;
};

/** Base federal — versionada. Alterações da lei entram como nova versão. */
export const FEDERAL_VERSION = "FEDERAL_2026";

export const FEDERAL_BASIS: Record<ParamKey, string> = {
  journeyHours: "CF art. 7º XIII / CLT art. 58",
  weeklyHours: "CF art. 7º XIII",
  maxOvertimeHours: "CLT art. 59",
  interJourneyHours: "CLT art. 66",
  mealBreakAfterHours: "CLT art. 71",
  mealBreakMinutes: "CLT art. 71",
  shortBreakAfterHours: "CLT art. 71 §1º",
  shortBreakMinutes: "CLT art. 71 §1º",
  maxConsecutiveDays: "CF art. 7º XV / Lei 605/49",
  nightStartMinutes: "CLT art. 73 §2º",
  nightEndMinutes: "CLT art. 73 §2º",
  requiresWrittenAgreement: "CLT art. 59-A",
};

export const FEDERAL_PARAMS: ComplianceParams = {
  journeyHours: 8,
  weeklyHours: 44,
  maxOvertimeHours: 2,
  interJourneyHours: 11,
  mealBreakAfterHours: 6,
  mealBreakMinutes: 60,
  shortBreakAfterHours: 4,
  shortBreakMinutes: 15,
  maxConsecutiveDays: 6,
  nightStartMinutes: 22 * 60,
  nightEndMinutes: 5 * 60,
  requiresWrittenAgreement: false,
};

/** Ajustes obrigatórios de cada regime sobre a base federal. */
export const REGIME_PARAMS: Record<WorkRegime, Partial<ComplianceParams>> = {
  padrao_5x2: {},
  padrao_6x1: {},
  escala_12x36: {
    journeyHours: 12,
    maxOvertimeHours: 0,
    interJourneyHours: 36,
    maxConsecutiveDays: 1,
    requiresWrittenAgreement: true,
  },
  escala_24x72: {
    journeyHours: 24,
    maxOvertimeHours: 0,
    interJourneyHours: 72,
    maxConsecutiveDays: 1,
    requiresWrittenAgreement: true,
  },
  estagio: {
    journeyHours: 6,
    weeklyHours: 30,
    maxOvertimeHours: 0,
    maxConsecutiveDays: 5,
  },
  parcial: {
    journeyHours: 6,
    weeklyHours: 30,
    maxOvertimeHours: 1,
  },
  intermitente: {
    journeyHours: 8,
    weeklyHours: 44,
    maxOvertimeHours: 2,
  },
};

export const REGIME_BASIS: Record<WorkRegime, string> = {
  padrao_5x2: "CLT art. 58",
  padrao_6x1: "CLT art. 58",
  escala_12x36: "CLT art. 59-A",
  escala_24x72: "CLT art. 59-A (acordo coletivo)",
  estagio: "Lei 11.788/2008 art. 10",
  parcial: "CLT art. 58-A",
  intermitente: "CLT art. 452-A",
};

/** Perfil de jornada resolvido a partir do banco. */
export type ComplianceProfile = {
  regime: WorkRegime;
  has_written_agreement?: boolean | null;
  /** Ajustes do próprio acordo individual. */
  params?: Partial<ComplianceParams> | null;
  agreement?: {
    name: string;
    valid_from?: string | null;
    valid_to?: string | null;
    confirmed?: boolean | null;
    params?: Partial<ComplianceParams> | null;
  } | null;
};
