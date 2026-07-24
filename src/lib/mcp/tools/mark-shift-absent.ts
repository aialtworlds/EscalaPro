import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed } from "../supabase";

export default defineTool({
  name: "mark_shift_absent",
  title: "Registrar falta",
  description: "Marca um turno como falta e registra uma ausência para o funcionário.",
  inputSchema: {
    shift_id: z.string().uuid().describe("UUID do turno."),
    reason: z.string().max(240).optional().describe("Motivo opcional."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ shift_id, reason }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data: shift, error } = await sb
      .from("shifts")
      .update({ status: "absent" })
      .eq("id", shift_id)
      .select()
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (shift?.employee_id) {
      await sb.from("absences").insert({
        owner_id: ctx.getUserId(),
        employee_id: shift.employee_id,
        absence_date: shift.shift_date,
        reason: reason ?? null,
      });
    }
    await sb.from("activity_log").insert({
      owner_id: ctx.getUserId(),
      event_type: "shift.absent_registered",
      payload: { shift_id, reason: reason ?? null, via: "mcp" },
    });
    return {
      content: [{ type: "text", text: `Falta registrada para o turno ${shift_id}.` }],
      structuredContent: { shift },
    };
  },
});
