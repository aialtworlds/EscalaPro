import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed } from "../supabase";

export default defineTool({
  name: "list_shifts_by_week",
  title: "Escala da semana",
  description:
    "Lista todos os turnos de uma semana a partir do dia inicial (YYYY-MM-DD, geralmente segunda-feira).",
  inputSchema: {
    week_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Data inicial da semana (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ week_start }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const start = new Date(week_start);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    const { data, error } = await supabaseForUser(ctx)
      .from("shifts")
      .select(
        "id, shift_date, start_time, end_time, status, is_freelancer, freelancer_label, is_extra, employees(name), sectors(name)",
      )
      .gte("shift_date", week_start)
      .lt("shift_date", endStr)
      .order("shift_date");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { shifts: data ?? [] },
    };
  },
});
