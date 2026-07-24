import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed } from "../supabase";

export default defineTool({
  name: "list_shifts_by_day",
  title: "Escala do dia",
  description:
    "Lista os turnos (escala operacional) de um dia específico. Data em formato YYYY-MM-DD.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Data no formato YYYY-MM-DD."),
    sector_id: z.string().uuid().optional().describe("Filtro opcional por setor."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, sector_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    let q = supabaseForUser(ctx)
      .from("shifts")
      .select(
        "id, shift_date, start_time, end_time, status, is_freelancer, freelancer_label, is_extra, employees(name, role_profile), sectors(name)",
      )
      .eq("shift_date", date)
      .order("start_time");
    if (sector_id) q = q.eq("sector_id", sector_id);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { shifts: data ?? [] },
    };
  },
});
