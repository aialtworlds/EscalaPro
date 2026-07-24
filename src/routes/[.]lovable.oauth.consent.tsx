import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthClient = {
  name?: string;
  logo_url?: string | null;
  redirect_uri?: string;
};
type OAuthDetails = {
  client?: OAuthClient;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = (
  supabase.auth as unknown as { oauth: OAuthApi }
).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get(
      "authorization_id",
    )!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-bold">Não foi possível carregar a autorização</h1>
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message ?? String(error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhuma URL de redirecionamento retornada.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "aplicativo externo";
  const redirectUri = details?.client?.redirect_uri;
  const scopes = details?.scopes ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <main className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-3">
              Autorização MCP
            </p>
            <h1 className="text-2xl font-black leading-tight">
              Conectar <span className="text-primary">{clientName}</span> ao EscalaPro
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Isto permite que {clientName} use as ferramentas do EscalaPro em seu
              nome, respeitando as permissões da sua conta.
            </p>
          </div>

          {redirectUri && (
            <div className="rounded-md border border-border bg-card/50 p-3 font-mono text-[11px] text-muted-foreground break-all">
              → {redirectUri}
            </div>
          )}

          {scopes.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Escopos solicitados
              </p>
              <ul className="text-sm space-y-1">
                {scopes.map((s) => (
                  <li key={s} className="font-mono">• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              disabled={busy}
              onClick={() => decide(true)}
              className="h-12 rounded-none bg-primary text-primary-foreground font-mono text-xs uppercase tracking-[0.3em] disabled:opacity-50 hover:bg-primary/90 transition"
            >
              {busy ? "Processando..." : "Autorizar acesso →"}
            </button>
            <button
              disabled={busy}
              onClick={() => decide(false)}
              className="h-12 rounded-none border border-border font-mono text-xs uppercase tracking-[0.3em] disabled:opacity-50 hover:bg-muted transition"
            >
              Negar
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Isto não substitui as políticas de acesso do EscalaPro. Os dados
            continuam protegidos pelas mesmas regras da sua conta.
          </p>
        </div>
      </main>
    </div>
  );
}
