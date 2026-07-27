// Cascata de resolução de parâmetros: federal → regime → convenção → acordo.
// A camada mais específica vence, e cada valor guarda de onde veio.

import {
  FEDERAL_BASIS,
  FEDERAL_PARAMS,
  REGIME_BASIS,
  REGIME_PARAMS,
  type ComplianceParams,
  type ComplianceProfile,
  type ParamKey,
  type ParamSource,
  type WorkRegime,
} from "./params";

export type ResolvedParams = {
  regime: WorkRegime;
  params: ComplianceParams;
  sources: Record<ParamKey, ParamSource>;
  /** Acordo escrito registrado para o regime (quando exigido). */
  hasWrittenAgreement: boolean;
  /** Avisos sobre a própria configuração (convenção vencida, não confirmada). */
  configWarnings: string[];
  /** Parâmetros definidos pelo regime — não podem ser rebaixados pelo cadastro. */
  regimeKeys: Set<ParamKey>;
};

const KEYS = Object.keys(FEDERAL_PARAMS) as ParamKey[];

const isValidNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const usable = (v: unknown) => typeof v === "boolean" || isValidNumber(v);

function applyLayer(
  target: ComplianceParams,
  sources: Record<ParamKey, ParamSource>,
  patch: Partial<ComplianceParams> | null | undefined,
  source: ParamSource,
) {
  if (!patch) return;
  for (const key of KEYS) {
    const value = patch[key];
    if (value === undefined || value === null || !usable(value)) continue;
    (target as Record<string, unknown>)[key] = value;
    sources[key] = source;
  }
}

function withinValidity(from: string | null | undefined, to: string | null | undefined, date: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/**
 * Resolve os parâmetros efetivos de um colaborador em uma data.
 * `date` importa porque a convenção tem vigência.
 */
export function resolveParams(profile: ComplianceProfile | null | undefined, date: string): ResolvedParams {
  const params: ComplianceParams = { ...FEDERAL_PARAMS };
  const sources = {} as Record<ParamKey, ParamSource>;
  for (const key of KEYS) sources[key] = { origin: "federal", basis: FEDERAL_BASIS[key] };

  const regime: WorkRegime = profile?.regime ?? "padrao_5x2";
  const regimePatch = REGIME_PARAMS[regime];
  applyLayer(params, sources, regimePatch, { origin: "federal", basis: REGIME_BASIS[regime] });
  const regimeKeys = new Set(Object.keys(regimePatch) as ParamKey[]);

  const configWarnings: string[] = [];
  const agreement = profile?.agreement ?? null;

  if (agreement) {
    const vigente = withinValidity(agreement.valid_from, agreement.valid_to, date);
    if (!agreement.confirmed) {
      configWarnings.push(
        `A convenção "${agreement.name}" ainda não foi confirmada — os parâmetros dela não estão sendo aplicados.`,
      );
    } else if (!vigente) {
      configWarnings.push(
        `A convenção "${agreement.name}" não está vigente em ${date} — voltando à base federal enquanto isso.`,
      );
    } else {
      applyLayer(params, sources, agreement.params, { origin: "convencao", basis: agreement.name });
    }
  }

  applyLayer(params, sources, profile?.params, { origin: "acordo", basis: "Acordo individual registrado" });

  return {
    regime,
    params,
    sources,
    hasWrittenAgreement: !!profile?.has_written_agreement,
    configWarnings,
    regimeKeys,
  };
}
