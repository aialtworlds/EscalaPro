import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha — EscalaPro" },
      { name: "description", content: "Defina uma nova senha para acessar o console EscalaPro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const q = url.searchParams;

      const errDesc = hash.get("error_description") || q.get("error_description");
      if (errDesc) {
        setLinkError(
          decodeURIComponent(errDesc).includes("expired")
            ? "O link expirou. Peça um novo em 'Esqueci minha senha'."
            : "Link inválido ou já utilizado. Peça um novo em 'Esqueci minha senha'.",
        );
        return;
      }

      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) {
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }
      }

      const token_hash = q.get("token_hash") || hash.get("token_hash");
      const code = q.get("code");
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
        if (!error) {
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }
        setLinkError("Link inválido ou já utilizado. Peça um novo em 'Esqueci minha senha'.");
        return;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setReady(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada. Bem-vindo de volta.");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative flex min-h-screen flex-col justify-center px-6 py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-3">
          Recuperação de acesso
        </p>
        <h1 className="font-black leading-[0.85] tracking-tight text-[3rem] sm:text-6xl mb-8">
          Nova <span className="text-primary">senha.</span>
        </h1>

        {!ready ? (
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Abra esta página pelo link enviado no seu e-mail.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Nova senha
              </Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Confirmar senha
              </Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-none border-0 border-b border-border bg-transparent px-0 text-base focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="mt-6 h-14 w-full rounded-none font-mono text-xs uppercase tracking-[0.3em]"
            >
              {loading ? "Salvando..." : "Salvar nova senha →"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
