// Modelo de monetização (sem cobrança ativa ainda).
//
// Regra do produto: tudo que é SEMANAL é gratuito. O que é MENSAL
// (matriz do mês, geração automática do mês e relatório de fechamento)
// pertence ao plano mensal pago.

export type PlanId = "free" | "pro";
export type SubStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

export type SubscriptionRow = {
  plan: string;
  status: string;
  provider: string;
  current_period_end: string | null;
};

export type PlanState = {
  plan: PlanId;
  status: SubStatus;
  provider: string;
  current_period_end: string | null;
  isPro: boolean;
};

/** Preço de referência do plano mensal — ajuste aqui quando definir o valor final. */
export const PRO_PRICE_BRL = 39;
export const PRO_PRICE_LABEL = `R$ ${PRO_PRICE_BRL}/mês`;

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free — Semanal",
  pro: "Pro — Mensal",
};

export const FREE_FEATURES = [
  "Escala semanal ilimitada (matriz da semana)",
  "Feed diário, faltas, freelancers e extras",
  "Motor de conformidade CLT e alertas por turno",
  "Duplicar semana, histórico e link de compartilhamento",
  "Exportar a semana em CSV e PDF",
  "Leitura de escala em papel pela câmera (OCR)",
];

export const PRO_FEATURES = [
  "Matriz do mês inteiro",
  "Geração automática de escala do mês completo",
  "Relatório mensal de fechamento (horas, extras, faltas)",
  "Exportação mensal em CSV e PDF",
];

/** Chaves usadas nas travas de recurso. */
export type ProFeature = "month_matrix" | "month_autofill" | "month_report";

export const PRO_FEATURE_COPY: Record<ProFeature, { title: string; body: string }> = {
  month_matrix: {
    title: "Visão do mês é do plano mensal",
    body: "No Free você monta e ajusta a escala semana a semana. A matriz do mês inteiro faz parte do plano mensal.",
  },
  month_autofill: {
    title: "Gerar o mês inteiro é do plano mensal",
    body: "A geração automática da semana continua liberada. Para gerar o mês completo de uma vez, assine o plano mensal.",
  },
  month_report: {
    title: "Relatório mensal é do plano mensal",
    body: "O fechamento do mês com horas, extras, faltas e alertas por colaborador faz parte do plano mensal.",
  },
};

/** Mensagem que o servidor devolve quando o recurso é pago. */
export const PRO_REQUIRED_ERROR = "PLANO_MENSAL_NECESSARIO";

export const FREE_STATE: PlanState = {
  plan: "free",
  status: "none",
  provider: "none",
  current_period_end: null,
  isPro: false,
};

export function planStateFromRow(row: SubscriptionRow | null | undefined): PlanState {
  if (!row) return FREE_STATE;
  const status = (row.status as SubStatus) ?? "none";
  const plan = (row.plan as PlanId) ?? "free";
  const notExpired =
    !row.current_period_end || new Date(row.current_period_end).getTime() > Date.now();
  const isPro = plan === "pro" && (status === "active" || status === "trialing") && notExpired;
  return { plan, status, provider: row.provider ?? "none", current_period_end: row.current_period_end, isPro };
}
