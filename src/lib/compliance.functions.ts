import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const regime = z.enum([
  "padrao_5x2",
  "padrao_6x1",
  "escala_12x36",
  "escala_24x72",
  "estagio",
  "parcial",
  "intermitente",
]);

/** Só estes parâmetros podem vir de convenção/acordo. */
const paramsSchema = z
  .object({
    journeyHours: z.number().min(1).max(24),
    weeklyHours: z.number().min(1).max(60),
    maxOvertimeHours: z.number().min(0).max(4),
    interJourneyHours: z.number().min(8).max(72),
    mealBreakAfterHours: z.number().min(1).max(12),
    mealBreakMinutes: z.number().min(0).max(180),
    shortBreakAfterHours: z.number().min(1).max(12),
    shortBreakMinutes: z.number().min(0).max(120),
    maxConsecutiveDays: z.number().min(1).max(12),
  })
  .partial();

export type AgreementParams = z.infer<typeof paramsSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---------------------------------------------------------------- convenções

export const listAgreements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agreements")
      .select("*")
      .order("valid_from", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(120),
        union_name: z.string().max(120).nullable().optional(),
        category: z.string().max(120).nullable().optional(),
        state_uf: z.string().max(2).nullable().optional(),
        city: z.string().max(120).nullable().optional(),
        valid_from: isoDate,
        valid_to: isoDate.nullable().optional(),
        params: paramsSchema.default({}),
        source: z.enum(["manual", "ia"]).default("manual"),
        confirmed: z.boolean().default(true),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId };
    const { data: saved, error } = await context.supabase
      .from("agreements")
      .upsert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: data.id ? "agreement.updated" : "agreement.created",
      payload: { name: data.name, source: data.source },
    });
    return saved;
  });

export const deleteAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agreements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------- perfis de jornada

export const listComplianceProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("compliance_profiles")
      .select("*, agreements(*)")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertComplianceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(80),
        regime,
        agreement_id: z.string().uuid().nullable().optional(),
        has_written_agreement: z.boolean().default(false),
        params: paramsSchema.default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("compliance_profiles")
      .upsert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteComplianceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("compliance_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setEmployeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ employee_id: z.string().uuid(), compliance_profile_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employees")
      .update({ compliance_profile_id: data.compliance_profile_id })
      .eq("id", data.employee_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------ feriados

export const listHolidays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("holidays").select("*").order("holiday_date");
    if (error) throw new Error(error.message);
    return data;
  });

export const createHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        holiday_date: isoDate,
        name: z.string().min(2).max(120),
        scope: z.enum(["nacional", "estadual", "municipal"]).default("nacional"),
        state_uf: z.string().max(2).nullable().optional(),
        city: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("holidays")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const importNationalHolidays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.number().int().min(2024).max(2100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { NATIONAL_HOLIDAYS } = await import("@/lib/clt/holidays.server");
    const rows = NATIONAL_HOLIDAYS(data.year).map((h) => ({
      owner_id: context.userId,
      holiday_date: h.date,
      name: h.name,
      scope: "nacional" as const,
    }));
    const { data: existing } = await context.supabase
      .from("holidays")
      .select("holiday_date")
      .gte("holiday_date", `${data.year}-01-01`)
      .lte("holiday_date", `${data.year}-12-31`);
    const known = new Set((existing ?? []).map((e) => e.holiday_date));
    const fresh = rows.filter((r) => !known.has(r.holiday_date));
    if (!fresh.length) return { inserted: 0 };
    const { error } = await context.supabase.from("holidays").insert(fresh);
    if (error) throw new Error(error.message);
    return { inserted: fresh.length };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("holidays").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------- liberações auditadas

export const listOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shift_ids: z.array(z.string().uuid()).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.shift_ids.length) return [];
    const { data: rows, error } = await context.supabase
      .from("compliance_overrides")
      .select("*")
      .in("shift_id", data.shift_ids);
    if (error) throw new Error(error.message);
    return rows;
  });

export const registerOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shift_id: z.string().uuid(),
        rule_code: z.string().min(2).max(60),
        justification: z.string().min(5).max(400),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("compliance_overrides")
      .upsert({ ...data, owner_id: context.userId }, { onConflict: "shift_id,rule_code" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "compliance.override",
      payload: { shift_id: data.shift_id, rule: data.rule_code, justification: data.justification },
    });
    return row;
  });

export const revokeOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("compliance_overrides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------- extração de convenção por IA (Fase 3)
// Nada entra no motor sem confirmação humana: esta função apenas sugere.

const extractionSchema = z.object({
  name: z.string().describe("Nome ou identificação da convenção."),
  union_name: z.string().nullable(),
  category: z.string().nullable(),
  state_uf: z.string().nullable().describe("Sigla da UF, 2 letras."),
  city: z.string().nullable(),
  valid_from: z.string().nullable().describe("Início da vigência, YYYY-MM-DD."),
  valid_to: z.string().nullable().describe("Fim da vigência, YYYY-MM-DD."),
  params: z.object({
    journeyHours: z.number().nullable().describe("Jornada diária em horas."),
    weeklyHours: z.number().nullable().describe("Jornada semanal em horas."),
    maxOvertimeHours: z.number().nullable().describe("Horas extras diárias permitidas."),
    interJourneyHours: z.number().nullable().describe("Descanso mínimo entre jornadas, em horas."),
    mealBreakMinutes: z.number().nullable().describe("Intervalo de refeição em minutos."),
    maxConsecutiveDays: z.number().nullable().describe("Dias consecutivos de trabalho permitidos."),
  }),
  clauses: z.array(z.string()).describe("Trechos citados que embasam cada parâmetro."),
});

export type AgreementExtraction = z.infer<typeof extractionSchema>;

export const extractAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        file_data_url: z.string().startsWith("data:").optional(),
        text: z.string().max(60000).optional(),
      })
      .refine((v) => v.file_data_url || v.text, "Envie um arquivo ou cole o texto da convenção.")
      .parse(d),
  )
  .handler(async ({ data }): Promise<AgreementExtraction> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const gateway = createLovableAiGatewayProvider(key);

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: "Extraia os parâmetros de jornada desta convenção coletiva. Use null em tudo que não estiver explícito no documento — não invente números.",
      },
    ];
    if (data.file_data_url) content.push({ type: "image", image: data.file_data_url });
    if (data.text) content.push({ type: "text", text: data.text });

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        output: Output.object({ schema: extractionSchema }),
        messages: [
          {
            role: "system",
            content:
              "Você lê convenções e acordos coletivos brasileiros e extrai parâmetros de jornada. Responda em português do Brasil. Só preencha um parâmetro quando o documento o afirmar de forma inequívoca; caso contrário use null. Em clauses, cite os trechos exatos que sustentam cada valor.",
          },
          { role: "user", content: content as never },
        ],
      });
      return output;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429")) throw new Error("Limite de uso da IA atingido. Tente em instantes.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados.");
      if (NoObjectGeneratedError.isInstance(err)) throw new Error("Não consegui interpretar o documento.");
      throw err;
    }
  });
