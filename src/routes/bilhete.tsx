import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSlip } from "@/lib/slip";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/radar/ui";
import { cn } from "@/lib/utils";
import { Sparkles, Trash2, Save, Square } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bilhete")({
  head: () => ({
    meta: [
      { title: "Simulador de bilhete com IA — RadarFC" },
      { name: "description", content: "Monte um bilhete simulado e receba uma análise de IA com valor esperado, brechas e padrões." },
      { property: "og:title", content: "Simulador de bilhete com IA — RadarFC" },
      { property: "og:description", content: "Análise de IA para bilhetes de futebol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SlipPage,
});

function SlipPage() {
  const { items, remove, clear, totalOdds, stake, setStake } = useSlip();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [analysis, setAnalysis] = useState("");
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const modelProb = items.every((i) => i.modelPct != null) && items.length ? items.reduce((a, i) => a * ((i.modelPct ?? 0) / 100), 1) : null;
  const implied = items.length ? 1 / totalOdds : 0;
  const ev = modelProb != null ? modelProb * totalOdds - 1 : null;

  const saved = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const runAI = async () => {
    if (!user) {
      toast("Entre na sua conta para usar a análise com IA");
      return;
    }
    setAnalysis("");
    setRunning(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-ticket", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({
          stake,
          selections: items.map((i) => ({ match: i.match, market: i.market, pick: i.pick, odds: i.odds, modelPct: i.modelPct ?? null, date: i.date })),
          context: `Probabilidade combinada do modelo: ${modelProb != null ? (modelProb * 100).toFixed(2) + "%" : "n/d"}. Probabilidade implícita das odds: ${(implied * 100).toFixed(2)}%.`,
        }),
      });
      if (!res.ok || !res.body) {
        toast.error(await res.text());
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysis((a) => a + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("A análise falhou. Tente novamente.");
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    if (!user) {
      toast("Entre na sua conta para salvar bilhetes");
      return;
    }
    const { error } = await supabase.from("tickets").insert({
      name: `Bilhete ${new Date().toLocaleDateString("pt-BR")} · ${items.length} seleções`,
      selections: JSON.parse(JSON.stringify(items)),
      stake,
      total_odds: totalOdds,
      ai_analysis: analysis || null,
    });
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Bilhete salvo");
    qc.invalidateQueries({ queryKey: ["tickets"] });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-4">
        <h1 className="font-display text-4xl font-bold uppercase">Meu <span className="text-primary">bilhete</span></h1>
        <Section title={`${items.length} seleções`} right={items.length > 0 && <button onClick={clear} className="text-xs text-muted-foreground hover:text-destructive">Limpar</button>}>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bilhete vazio. Adicione palpites a partir de um <Link to="/" className="text-primary underline">jogo</Link> ou do <Link to="/oportunidades" className="text-primary underline">oportunidades do dia</Link>.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-md bg-surface p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{i.match}</p>
                    <p className="text-sm font-semibold">{i.market}: {i.pick}</p>
                    <p className="text-[11px] text-muted-foreground">{i.source}{i.modelPct != null && ` · modelo ${i.modelPct}%`}</p>
                  </div>
                  <span className="tabular text-lg font-bold text-primary">{i.odds.toFixed(2)}</span>
                  <button onClick={() => remove(i.id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <label className="flex items-center justify-between text-sm">
                <span>Valor simulado (R$)</span>
                <input type="number" min={1} value={stake} onChange={(e) => setStake(Math.max(0, Number(e.target.value)))} className="tabular h-9 w-28 rounded-md border bg-surface px-2 text-right outline-none focus:border-primary" />
              </label>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <Stat l="Odd total" v={totalOdds.toFixed(2)} />
                <Stat l="Retorno possível" v={`R$ ${(stake * totalOdds).toFixed(2)}`} hi />
                <Stat l="Prob. implícita" v={`${(implied * 100).toFixed(1)}%`} />
                <Stat l="Prob. do modelo" v={modelProb != null ? `${(modelProb * 100).toFixed(1)}%` : "n/d"} />
                {ev != null && <Stat l="Valor esperado" v={`${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`} tone={ev > 0 ? "good" : "bad"} />}
              </div>
              <div className="flex gap-2">
                {running ? (
                  <button onClick={() => abort.current?.abort()} className="flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm">
                    <Square className="h-4 w-4" /> Parar
                  </button>
                ) : (
                  <button onClick={runAI} className="glow flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                    <Sparkles className="h-4 w-4" /> Analisar com IA
                  </button>
                )}
                <button onClick={save} className="flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm hover:border-primary/60">
                  <Save className="h-4 w-4" /> Salvar
                </button>
              </div>
              {!user && <p className="text-xs text-muted-foreground"><Link to="/auth" className="text-primary underline">Entre</Link> para usar a IA e salvar bilhetes.</p>}
            </div>
          )}
        </Section>
        <p className="text-xs text-muted-foreground">Simulação para fins de análise. Nenhuma aposta real é feita. Jogue com responsabilidade (+18).</p>
      </div>

      <div className="space-y-4">
        <Section title="Análise da IA" right={running && <span className="text-xs text-primary">analisando…</span>}>
          {analysis ? (
            <div className="prose-sm space-y-2 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_h2]:text-primary [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Monte o bilhete e clique em “Analisar com IA”. A IA compara a probabilidade do modelo com a odd de cada seleção, aponta brechas e sugere ajustes.</p>
          )}
        </Section>
        {user && (
          <Section title="Bilhetes salvos">
            {(saved.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum bilhete salvo ainda.</p>
            ) : (
              <ul className="divide-y text-sm">
                {saved.data!.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p>{t.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(t.stake).toFixed(2)} · odd {Number(t.total_odds).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from("tickets").delete().eq("id", t.id);
                        qc.invalidateQueries({ queryKey: ["tickets"] });
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function Stat({ l, v, hi, tone }: { l: string; v: string; hi?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md bg-surface p-2">
      <p className={cn("tabular text-base font-bold", hi && "text-primary", tone === "good" && "text-win", tone === "bad" && "text-loss")}>{v}</p>
      <p className="text-muted-foreground">{l}</p>
    </div>
  );
}
