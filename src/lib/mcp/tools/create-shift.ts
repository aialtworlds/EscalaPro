import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed } from "../supabase";

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export default defineTool({
  name: "create_shift",
  title: "Criar turno",
  description:
    "Cria um novo turno na escala. Pode ser um turno regular (empregado + setor), extra ou de freelancer.",
  inputSchema: {
    shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data (YYYY-MM-DD)."),
    start_time: z.string().regex(timeRegex).describe("Início (HH:MM)."),
    end_time: z.string().regex(timeRegex).describe("Fim (HH:MM)."),
    sector_id: z.string().uuid().nullable().optional(),
    employee_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe("Funcionário CLT. Deixe null para freelancer."),
    is_freelancer: z.boolean().optional().default(false),
    freelancer_label: z
      .string()
      .max(120)
      .nullable()
      .optional()
      .describe("Nome do freelancer, quando aplicável."),
    is_extra: z.boolean().optional().default(false),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("shifts")
      .insert({
        owner_id: ctx.getUserId(),
        shift_date: input.shift_date,
        start_time: input.start_time,
        end_time: input.end_time,
        sector_id: input.sector_id ?? null,
        employee_id: input.employee_id ?? null,
        is_freelancer: input.is_freelancer ?? false,
        freelancer_label: input.freelancer_label ?? null,
        is_extra: input.is_extra ?? false,
      })
      .select()
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    await sb.from("activity_log").insert({
      owner_id: ctx.getUserId(),
      event_type: input.is_freelancer ? "shift.freelancer_injected" : "shift.created",
      payload: { shift_id: data.id, date: input.shift_date, via: "mcp" },
    });
    return {
      content: [{ type: "text", text: `Turno criado: ${data.id}` }],
      structuredContent: { shift: data },
    };
  },
});
