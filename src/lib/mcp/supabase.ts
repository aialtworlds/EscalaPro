import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// Build a Supabase client that acts as the OAuth-authenticated user, so RLS
// applies as that user. Never use the service-role key here.
export function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function notAuthed() {
  return {
    content: [{ type: "text" as const, text: "Não autenticado." }],
    isError: true,
  };
}
