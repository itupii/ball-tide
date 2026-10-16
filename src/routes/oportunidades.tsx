import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getScoreboard, type MatchSummary } from "@/lib/espn.functions";
import { edge, fairOdds, predict, profile } from "@/lib/analytics";
import { teamHistoryQuery } from "@/components/radar/match-extras";
import { Bar, OddButton, Section, TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/oportunidades")({
  head: () => ({
    meta: [
      { title: "Oportunidades do dia no futebol — RadarFC" },
      { name: "description", content: "As melhores oportunidades estatísticas dos jogos de hoje, calculadas por modelo e histórico." },
      { property: "og:title", content: "Oportunidades do dia — RadarFC" },
      { property: "og:description", content: "Mercados com maior probabilidade e valor nos jogos de hoje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OppPage,
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

interface Opp { m: MatchSummary; market: string; pick: string; pct: number; odds: number | null; value: number | null; why: string }

const FILTERS = [["all", "Todos"], ["result", "Resultado"], ["goals", "Gols"], ["btts", "Ambas marcam"], ["value", "Com valor"]] as const;

function OppPage() {
  const date = today();
  const sb = useQuery({ queryKey: ["scoreboard", date], queryFn: () => getScoreboard({ data: { date } }), refetchInterval: 60_000 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const pool = useMemo(() => {
    const pre = (sb.data?.matches ?? []).filter((m) => m.state === "pre");
    return [...pre.filter((m) => m.odds), ...pre.filter((m) => !m.odds)].slice(0, 30);
  }, [sb.data]);
  const ids = [...new Set(pool.flatMap((m) => [m.home.id, m.away.id]))];
  const hist = useQueries({ queries: ids.map((id) => teamHistoryQuery(id)) });
  const byId = Object.fromEntries(ids.map((id, i) => [id, hist[i]?.data?.games ?? null]));
  const loaded = hist.filter((h) => !h.isLoading).length;

  const opps = useMemo(() => {
    const out: Opp[] = [];
    for (const m of pool) {
      const hg = byId[m.home.id], ag = byId[m.away.id];
      if (!hg || !ag || hg.length < 6 || ag.length < 6) continue;
      const hp = profile(hg.slice(0, 20)), ap = profile(ag.slice(0, 20));
      const pr = predict(hp, ap);
      const o = m.odds;
      const add = (market: string, pick: string, pct: number, odds: number | null, why: string) =>
        out.push({ m, market, pick, pct, odds, value: odds ? edge(pct, odds) : null, why });
      add("Resultado final", m.home.short, pr.home, o?.home ?? null, `${m.home.short} vence ${hp.winPct}% · ${m.away.short} perde ${ap.lossPct}%`);
      add("Resultado final", m.away.short, pr.away, o?.away ?? null, `${m.away.short} vence ${ap.winPct}% · ${m.home.short} perde ${hp.lossPct}%`);
      add("Dupla chance", `${m.home.short} ou empate`, pr.doubleChance["1X"], null, `${m.home.short} não perde ${100 - hp.lossPct}%`);
      add("Dupla chance", `${m.away.short} ou empate`, pr.doubleChance.X2, null, `${m.away.short} não perde ${100 - ap.lossPct}%`);
      add("Gols", "Mais de 1.5", pr.over["1.5"] ?? 0, null, `Over 1.5: ${hp.over15}% / ${ap.over15}%`);
      add("Gols", "Mais de 2.5", pr.over["2.5"] ?? 0, null, `Over 2.5: ${hp.over25}% / ${ap.over25}%`);
      add("Gols", "Menos de 2.5", 100 - (pr.over["2.5"] ?? 0), null, `Under 2.5: ${100 - hp.over25}% / ${100 - ap.over25}%`);
      add("Gols", "Menos de 3.5", 100 - (pr.over["3.5"] ?? 0), null, `Under 3.5: ${100 - hp.over35}% / ${100 - ap.over35}%`);
      add("Ambas marcam", "Sim", pr.btts, null, `BTTS: ${hp.btts}% / ${ap.btts}%`);
      add("Ambas marcam", "Não", 100 - pr.btts, null, `Sem sofrer: ${hp.cleanSheet}% / ${ap.cleanSheet}%`);
    }
    return out;
  }, [pool, hist.map((h) => h.dataUpdatedAt).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = opps
    .filter((x) => {
      if (filter === "result") return x.market === "Resultado final" || x.market === "Dupla chance";
      if (filter === "goals") return x.market === "Gols";
      if (filter === "btts") return x.market === "Ambas marcam";
      if (filter === "value") return (x.value ?? -1) > 0.03;
      return x.market !== "Dupla chance" || x.pct >= 80;
    })
    .sort((a, b) => (filter === "value" ? (b.value ?? 0) - (a.value ?? 0) : b.pct - a.pct))
    .filter((x, i, arr) => filter === "value" || arr.findIndex((y) => y.m.id === x.m.id) === i || x.pct >= 75)
    .slice(0, 40);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-bold uppercase">Oportunidades <span className="text-primary">do dia</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Os mercados mais prováveis dos jogos de hoje, pelo modelo de gols e pelo histórico recente das equipes. Clique para adicionar ao bilhete.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1 text-sm", filter === k ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      {(sb.isLoading || loaded < ids.length) && (
        <p className="text-xs text-muted-foreground">Analisando {pool.length} jogos… {ids.length ? Math.round((loaded / ids.length) * 100) : 0}%</p>
      )}
      {!sb.isLoading && pool.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhum jogo por começar hoje.</p>}
      {loaded === ids.length && pool.length > 0 && list.length === 0 && <p className="py-10 text-center text-muted-foreground">Nenhuma oportunidade neste filtro.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((x, i) => {
          const label = `${x.m.home.short} x ${x.m.away.short}`;
          const odds = x.odds ?? fairOdds(x.pct);
          return (
            <Section
              key={`${x.m.id}-${x.pick}-${i}`}
              title={`${x.market}: ${x.pick}`}
              right={<span className="tabular text-lg font-bold text-primary">{x.pct}%</span>}
            >
              <Link to="/jogo/$id" params={{ id: x.m.id }} className="mb-2 flex items-center gap-2 text-sm hover:text-primary">
                <TeamLogo src={x.m.home.logo} alt={x.m.home.name} size={20} />
                <span className="font-semibold">{label}</span>
                <TeamLogo src={x.m.away.logo} alt={x.m.away.name} size={20} />
                <span className="ml-auto text-xs text-muted-foreground" suppressHydrationWarning>{new Date(x.m.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {x.m.league}</span>
              </Link>
              <Bar value={x.pct} tone={x.pct >= 75 ? "primary" : "accent"} />
              <p className="mt-2 text-xs text-muted-foreground">{x.why}</p>
              <div className="mt-3 flex items-center gap-3">
                <OddButton
                  label={x.odds ? "Odd da casa" : "Odd justa"}
                  sub={x.odds ? x.m.odds?.provider ?? "" : "modelo"}
                  sel={{ id: `${x.m.id}:${x.market}:${x.pick}`, matchId: x.m.id, match: label, market: x.market, pick: x.pick, odds, modelPct: x.pct, source: x.odds ? x.m.odds?.provider ?? "Casa" : "Modelo", date: x.m.date }}
                />
                {x.value != null && (
                  <span className={cn("text-xs font-semibold", x.value > 0 ? "text-primary" : "text-muted-foreground")}>Valor {x.value > 0 ? "+" : ""}{Math.round(x.value * 100)}%</span>
                )}
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
