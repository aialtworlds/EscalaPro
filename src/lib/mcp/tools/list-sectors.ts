import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthed } from "../supabase";

export default defineTool({
  name: "list_sectors",
  title: "Listar setores",
  description: "Lista todos os setores operacionais do usuário autenticado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("sectors")
      .select("id, name, color, created_at")
      .order("name");
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sectors: data ?? [] },
    };
  },
});
