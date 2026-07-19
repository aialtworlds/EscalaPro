import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const scanSchema = z.object({
  employees: z.array(
    z.object({
      name: z.string(),
      shifts: z.array(
        z.object({
          weekday: z.string().describe("Nome do dia da semana em português: segunda, terca, quarta, quinta, sexta, sabado, domingo. Use 'folga' se for folga."),
          start_time: z.string().describe("Formato HH:MM, ou string vazia se folga"),
          end_time: z.string().describe("Formato HH:MM, ou string vazia se folga"),
        }),
      ),
    }),
  ),
});

export type ScanResult = z.infer<typeof scanSchema>;

export const scanSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      image_data_url: z.string().startsWith("data:"),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<ScanResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: scanSchema }),
        messages: [
          {
            role: "system",
            content:
              "Você extrai escalas de trabalho de fotos de planilhas, rascunhos ou folhas em papel. Retorne cada colaborador com seus turnos por dia da semana. Horários no formato 24h HH:MM. Se um dia for folga, use weekday igual ao dia (segunda, terca, etc.) e horários vazios. Aceite variações como 8h, 08:00, 8-16. Padronize.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os funcionários e turnos desta escala." },
              { type: "image", image: data.image_data_url },
            ],
          },
        ],
      });
      return output;
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        throw new Error("Limite de uso da IA atingido. Aguarde alguns instantes e tente de novo.");
      }
      if (err instanceof Error && err.message.includes("402")) {
        throw new Error("Créditos de IA esgotados. Adicione créditos no workspace para continuar.");
      }
      if (NoObjectGeneratedError.isInstance(err)) {
        throw new Error("Não consegui interpretar a imagem. Tente outra foto mais nítida.");
      }
      throw err;
    }
  });

const applySchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sector_id: z.string().uuid().nullable(),
  entries: z.array(
    z.object({
      employee_id: z.string().uuid(),
      shifts: z.array(
        z.object({
          shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          start_time: z.string().regex(/^\d{2}:\d{2}$/),
          end_time: z.string().regex(/^\d{2}:\d{2}$/),
        }),
      ),
    }),
  ),
});

export const applyScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applySchema.parse(d))
  .handler(async ({ data, context }) => {
    const rows = data.entries.flatMap((entry) =>
      entry.shifts.map((s) => ({
        owner_id: context.userId,
        employee_id: entry.employee_id,
        sector_id: data.sector_id,
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
    );
    if (rows.length === 0) return { inserted: 0 };
    const { error } = await context.supabase.from("shifts").insert(rows);
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "scan.applied",
      payload: { week_start: data.week_start, count: rows.length },
    });
    return { inserted: rows.length };
  });
