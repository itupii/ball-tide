import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — RadarFC" },
      {
        name: "description",
        content: "Entre para salvar bilhetes, times favoritos e usar a análise com IA.",
      },
      { property: "og:title", content: "Entrar — RadarFC" },
      { property: "og:description", content: "Acesse sua conta RadarFC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user)
    return (
      <div className="mx-auto max-w-sm space-y-4 rounded-xl border bg-card p-6 text-center">
        <p>
          Conectado como <b>{user.email}</b>
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full rounded-md border px-4 py-2 text-sm"
        >
          Sair
        </button>
      </div>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/bilhete" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error("Falha ao entrar com Google");
  };

  return (
    <div className="mx-auto max-w-sm space-y-5 rounded-xl border bg-card p-6">
      <h1 className="font-display text-3xl font-bold uppercase">
        {mode === "in" ? "Entrar" : "Criar conta"}
      </h1>
      <button
        onClick={google}
        className="w-full rounded-md border bg-secondary px-4 py-2.5 text-sm font-medium hover:border-primary/60"
      >
        Continuar com Google
      </button>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-md border bg-surface px-3 text-sm outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-md border bg-surface px-3 text-sm outline-none focus:border-primary"
        />
        <button
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {mode === "in" ? "Entrar" : "Criar conta"}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "in" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}
