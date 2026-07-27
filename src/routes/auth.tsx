import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},

  head: () => ({
    meta: [
      { title: "Entrar — EscalaPro" },
      { name: "description", content: "Acesse o console operacional de escalas EscalaPro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined): string {
  if (!next) return "/feed";
  // only accept same-origin relative paths
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/feed";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target });
    });
  }, [navigate, target]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${target}`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Você já pode entrar.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient grid + glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex min-h-screen flex-col px-6 py-10">
        {/* Top status strip */}
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Console v1.0
          </span>
          <span>PT-BR</span>
        </div>

        {/* Hero brand */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-3">
              Sistema Operacional de Escala
            </p>
            <h1 className="font-black leading-[0.85] tracking-tight">
              <span className="block text-[3.75rem] sm:text-7xl">Escala</span>
              <span className="block text-[3.75rem] sm:text-7xl text-primary">Pro.</span>
            </h1>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {mode === "signin" ? "Autenticação" : "Novo operador"}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Nome
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como te chamamos"
                  className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-primary focus-visible:ring-0"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="voce@empresa.com"
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-primary focus-visible:ring-0"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-6 h-14 w-full rounded-none font-mono text-xs uppercase tracking-[0.3em]"
            >
              {loading ? "Processando..." : mode === "signin" ? "Entrar no console →" : "Criar operador →"}
            </Button>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full pt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition"
            >
              {mode === "signin" ? "Sem acesso? Cadastrar operador" : "Já tenho acesso · Entrar"}
            </button>
          </form>
        </div>

        {/* Footer strip */}
        <div className="mt-10 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <span>© EscalaPro</span>
          <span className="text-primary">● Online</span>
        </div>
      </div>
    </div>
  );
}
