import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed } from "../supabase";

export default defineTool({
  name: "list_employees",
  title: "Listar funcionários",
  description:
    "Lista os funcionários (colaboradores) do usuário. Opcionalmente filtra por setor.",
  inputSchema: {
    sector_id: z
      .string()
      .uuid()
      .optional()
      .describe("UUID do setor para filtrar. Opcional."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sector_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    let q = supabaseForUser(ctx)
      .from("employees")
      .select("id, name, role_profile, sector_id, sectors(name)")
      .order("name");
    if (sector_id) q = q.eq("sector_id", sector_id);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { employees: data ?? [] },
    };
  },
});
