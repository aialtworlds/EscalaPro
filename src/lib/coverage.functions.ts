import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildCandidates, candidatesPrompt, mondayUTC, addDaysUTC } from "@/lib/coverage.server";

export const suggestCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shift_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: gap, error } = await context.supabase
      .from("shifts")
      .select("*, sectors(name)")
      .eq("id", data.shift_id)
      .single();
    if (error) throw new Error(error.message);

    const week = mondayUTC(gap.shift_date);
    const [{ data: employees }, { data: weekShifts }, { data: holidays }] = await Promise.all([
      context.supabase.from("employees").select("*, compliance_profiles(*, agreements(*))"),
      context.supabase
        .from("shifts")
        .select("id, employee_id, shift_date, start_time, end_time, status")
        .gte("shift_date", week)
        .lt("shift_date", addDaysUTC(week, 7)),
      context.supabase
        .from("holidays")
        .select("holiday_date, name, scope")
        .gte("holiday_date", week)
        .lt("holiday_date", addDaysUTC(week, 7)),
    ]);

    const candidates = buildCandidates(
      gap as never,
      (employees ?? []) as never,
      (weekShifts ?? []) as never,
      gap.sector_id,
      holidays ?? [],
    );
    const eligible = candidates.filter((c) => !c.blocked);
    if (!eligible.length) return { candidates, ranked: [] as { employee_id: string; reason: string }[] };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { candidates, ranked: [] as { employee_id: string; reason: string }[] };

    try {
      const gateway = createLovableAiGatewayProvider(key);
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system:
          "Você é um planejador de escalas brasileiro. Respeita rigorosamente a CLT e responde em português do Brasil, de forma objetiva.",
        prompt: candidatesPrompt(gap as never, gap.sectors?.name ?? null, eligible),
        output: Output.object({
          schema: z.object({
            picks: z.array(z.object({ employee_id: z.string(), reason: z.string() })),
          }),
        }),
      });
      const valid = (output?.picks ?? [])
        .filter((p) => eligible.some((c) => c.employee_id === p.employee_id))
        .slice(0, 3);
      return { candidates, ranked: valid };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) return { candidates, ranked: [] };
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("429")) throw new Error("Limite de uso da IA atingido. Tente em instantes.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados.");
      return { candidates, ranked: [] };
    }
  });
