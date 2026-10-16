import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getMatch, type PastGame } from "@/lib/espn.functions";
import { edge, fairOdds, findPatterns, predict, profile } from "@/lib/analytics";
import { Bar, FormPill, LiveBadge, OddButton, Section, TeamLogo } from "@/components/radar/ui";
import { MatchCharts } from "@/components/radar/charts";
import { AiMatchAnalysis, AlertButton, TeamEval, teamHistoryQuery, useLiveAlerts } from "@/components/radar/match-extras";
import { cn } from "@/lib/utils";
import type { Selection } from "@/lib/slip";

const matchQuery = (id: string) =>
  queryOptions({
    queryKey: ["match", id],
    queryFn: () => getMatch({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.match.state === "in" ? 15_000 : q.state.data?.match.state === "pre" ? 60_000 : false),
  });

export const Route = createFileRoute("/jogo/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(matchQuery(params.id)),
  head: ({ loaderData }) => {
    const m = loaderData?.match;
    const t = m ? `${m.home.name} x ${m.away.name} — estatísticas e probabilidades | RadarFC` : "Partida | RadarFC";
    const d = m ? `Análise de ${m.home.name} x ${m.away.name} (${m.league}): estatísticas ao vivo, forma, confronto direto e probabilidades.` : "Análise da partida.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: MatchPage,
  errorComponent: () => <p className="py-12 text-center text-muted-foreground">Não foi possível carregar esta partida.</p>,
});

type Tab = "resumo" | "stats" | "prob" | "forma" | "tabela" | "avaliar" | "ia";

function MatchPage() {
  const { id } = Route.useParams();
  const { data } = useQuery(matchQuery(id));
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("prob");
  const alerts = useLiveAlerts(data?.match);
  if (!data) return null;
  const { match: m, stats, homeLast, awayLast, h2h, standings } = data;
  const hp = profile(homeLast);
  const ap = profile(awayLast);
  const pr = predict(hp, ap);
  const label = `${m.home.short} x ${m.away.short}`;
  const openEval = () => {
    setTab("avaliar");
    setTimeout(() => document.getElementById("match-tabs")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const buildContext = async () => {
    const [th, ta] = await Promise.all([qc.ensureQueryData(teamHistoryQuery(m.home.id)).catch(() => null), qc.ensureQueryData(teamHistoryQuery(m.away.id)).catch(() => null)]);
    const fmt = (name: string, g: PastGame[]) => {
      const p = profile(g), h = profile(g, "home"), a = profile(g, "away");
      const pats = findPatterns(g).slice(0, 6).map((x) => `${x.label} (${x.hits}/${x.total})`).join("; ");
      return `${name} — ${p.games} jogos: V${p.winPct}% E${p.drawPct}% D${p.lossPct}%, gols pró ${p.gfAvg}/j, contra ${p.gaAvg}/j, over2.5 ${p.over25}%, BTTS ${p.btts}%, sem sofrer ${p.cleanSheet}%, não marcou ${p.failedToScore}%, forma ${p.form.join("")}, ${p.streak}. Casa: V${h.winPct}% gols ${h.gfAvg}-${h.gaAvg}. Fora: V${a.winPct}% gols ${a.gfAvg}-${a.gaAvg}. Padrões: ${pats || "nenhum"}.`;
    };
    const st = standings.filter((r) => r.teamId === m.home.id || r.teamId === m.away.id).map((r) => `${r.team}: ${r.rank}º, ${r.points} pts em ${r.played}j, saldo ${r.gf - r.ga}`).join("; ");
    return [
      `Partida: ${m.home.name} (mandante) x ${m.away.name} — ${m.league} — ${m.date}. Status: ${m.status} ${m.state === "in" ? `placar ${m.home.score}-${m.away.score} ${m.clock}` : ""}`,
      fmt(m.home.name, th?.games?.slice(0, 20) ?? homeLast),
      fmt(m.away.name, ta?.games?.slice(0, 20) ?? awayLast),
      `Confronto direto: ${h2h.map((g) => `${g.goalsFor}-${g.goalsAgainst}`).join(", ") || "n/d"}`,
      `Classificação: ${st || "n/d"}`,
      `Modelo Poisson: xG ${pr.lambdaHome}x${pr.lambdaAway}; 1 ${pr.home}% X ${pr.draw}% 2 ${pr.away}%; over1.5 ${pr.over["1.5"]}% over2.5 ${pr.over["2.5"]}% over3.5 ${pr.over["3.5"]}%; BTTS ${pr.btts}%; placares ${pr.scores.slice(0, 4).map((s) => `${s.score} ${s.p}%`).join(", ")}`,
      m.odds ? `Odds (${m.odds.provider}): 1 ${m.odds.home ?? "-"} X ${m.odds.draw ?? "-"} 2 ${m.odds.away ?? "-"}, linha de gols ${m.odds.overUnder ?? "-"}` : "Odds: n/d",
      stats.length ? `Estatísticas ao vivo: ${stats.map((s) => `${s.label} ${s.home}-${s.away}`).join("; ")}` : "",
      m.events.length ? `Lances: ${m.events.map((e) => `${e.minute} ${e.type} ${e.player ?? ""}`).join("; ")}` : "",
    ].join("\n");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5 md:p-7">
        <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-display text-sm uppercase tracking-wider">{m.league}</span>
          {m.state === "in" ? <LiveBadge text={m.clock || m.status} /> : <span suppressHydrationWarning>{m.state === "pre" ? new Date(m.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : m.status}</span>}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamHead t={m.home} onClick={openEval} />
          <div className="tabular text-center text-5xl font-bold md:text-6xl">
            <span className={cn(m.state === "in" && "text-primary")}>{m.home.score ?? "-"}</span>
            <span className="mx-2 text-muted-foreground">:</span>
            <span className={cn(m.state === "in" && "text-primary")}>{m.away.score ?? "-"}</span>
          </div>
          <TeamHead t={m.away} right onClick={openEval} />
        </div>
        {m.events.filter((e) => e.goal).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            {[m.home.id, m.away.id].map((tid, i) => (
              <div key={tid} className={cn("space-y-0.5", i === 1 && "text-right")}>
                {m.events
                  .filter((e) => e.goal && e.teamId === tid)
                  .map((e, k) => (
                    <div key={k}>
                      ⚽ {e.player} {e.minute}
                      {e.penalty ? " (pên.)" : ""}
                      {e.ownGoal ? " (contra)" : ""}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
        {m.venue && <p className="mt-4 text-center text-xs text-muted-foreground">{m.venue}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {m.state !== "post" && <AlertButton on={alerts.on} toggle={alerts.toggle} />}
          <button onClick={openEval} className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Avaliar equipes</button>
          <button onClick={() => setTab("ia")} className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Análise com IA</button>
        </div>
      </div>

      <div id="match-tabs" className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {(
          [
            ["prob", "Probabilidades"],
            ["avaliar", "Avaliar equipes"],
            ["ia", "Análise IA"],
            ["stats", "Estatísticas"],
            ["resumo", "Lances"],
            ["forma", "Forma & H2H"],
            ["tabela", "Classificação"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("whitespace-nowrap rounded-md px-4 py-2 text-sm", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {l}
          </button>
        ))}
      </div>

      {tab === "prob" && <ProbTab data={data} pr={pr} label={label} />}

      {tab === "avaliar" && (
        <div className="grid gap-4 md:grid-cols-2">
          <TeamEval team={m.home} />
          <TeamEval team={m.away} />
        </div>
      )}
      {(tab === "avaliar" || tab === "ia" || tab === "prob") && <MatchCharts home={m.home} away={m.away} pr={pr} />}

      {tab === "ia" && <AiMatchAnalysis buildContext={buildContext} />}

      {tab === "stats" && (
        <Section title="Estatísticas da partida">
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">As estatísticas aparecem quando a partida começar.</p>
          ) : (
            <div className="space-y-3">
              {stats.map((s) => {
                const h = parseFloat(s.home) || 0;
                const a = parseFloat(s.away) || 0;
                const tot = h + a || 1;
                return (
                  <div key={s.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="tabular font-semibold">{s.home}</span>
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="tabular font-semibold">{s.away}</span>
                    </div>
                    <div className="flex h-1.5 gap-1">
                      <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${(h / tot) * 100}%` }} />
                      </div>
                      <div className="flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-accent" style={{ width: `${(a / tot) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {tab === "resumo" && (
        <Section title="Linha do tempo">
          {m.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lance registrado ainda.</p>
          ) : (
            <ol className="space-y-2">
              {m.events.map((e, i) => {
                const home = e.teamId === m.home.id;
                return (
                  <li key={i} className={cn("flex items-center gap-3 text-sm", !home && "flex-row-reverse text-right")}>
                    <span className="tabular w-10 shrink-0 text-xs text-muted-foreground">{e.minute}</span>
                    <span>{e.goal ? "⚽" : e.red ? "🟥" : e.yellow ? "🟨" : "•"}</span>
                    <span>
                      <b>{e.player ?? "—"}</b> <span className="text-muted-foreground">{e.goal ? "Gol" : e.red ? "Cartão vermelho" : e.yellow ? "Cartão amarelo" : e.type}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      )}

      {tab === "forma" && (
        <div className="grid gap-4 md:grid-cols-2">
          <FormBlock title={m.home.name} games={homeLast} />
          <FormBlock title={m.away.name} games={awayLast} />
          <Section title="Confronto direto" className="md:col-span-2">
            {h2h.length === 0 ? <p className="text-sm text-muted-foreground">Sem confrontos recentes registrados.</p> : <GamesList games={h2h} />}
          </Section>
        </div>
      )}

      {tab === "tabela" && (
        <Section title="Classificação">
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Classificação indisponível para esta competição.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    {["#", "Time", "J", "V", "E", "D", "GP", "GC", "SG", "Pts"].map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((r) => (
                    <tr key={r.teamId + r.rank} className={cn("border-b", (r.teamId === m.home.id || r.teamId === m.away.id) && "bg-primary/10")}>
                      <td className="tabular px-2 py-1.5">{r.rank}</td>
                      <td className="px-2 py-1.5">{r.team}</td>
                      {[r.played, r.wins, r.draws, r.losses, r.gf, r.ga, r.gf - r.ga].map((v, i) => (
                        <td key={i} className="tabular px-2 py-1.5">{v}</td>
                      ))}
                      <td className="tabular px-2 py-1.5 font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function TeamHead({ t, right, onClick }: { t: { id: string; name: string; logo: string | null; form: string | null; record: string | null }; right?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-2 text-center hover:opacity-90", right ? "md:items-center" : "")}>
      <TeamLogo src={t.logo} alt={t.name} size={64} />
      <span className="font-display text-lg font-semibold uppercase leading-tight md:text-2xl">{t.name}</span>
      {t.form && <span className="text-xs tracking-[0.3em] text-muted-foreground">{t.form}</span>}
    </button>
  );
}

function ProbTab({ data, pr, label }: { data: Awaited<ReturnType<typeof getMatch>>; pr: ReturnType<typeof predict>; label: string }) {
  const m = data.match;
  const book = m.odds;
  const patternsH = useMemo(() => findPatterns(data.homeLast).slice(0, 5), [data.homeLast]);
  const patternsA = useMemo(() => findPatterns(data.awayLast).slice(0, 5), [data.awayLast]);
  const mk = (market: string, pick: string, pct: number, odds?: number | null): Selection => ({
    id: `${m.id}:${market}:${pick}`,
    matchId: m.id,
    match: label,
    market,
    pick,
    odds: odds && odds > 1 ? odds : fairOdds(pct),
    modelPct: pct,
    source: odds && odds > 1 ? (book?.provider ?? "Casa") : "Odd justa do modelo",
    date: m.date,
  });
  const rows: { market: string; picks: [string, number, number | null | undefined][] }[] = [
    { market: "Resultado final", picks: [[m.home.short, pr.home, book?.home], ["Empate", pr.draw, book?.draw], [m.away.short, pr.away, book?.away]] },
    { market: "Dupla chance", picks: [["1X", pr.doubleChance["1X"], null], ["12", pr.doubleChance["12"], null], ["X2", pr.doubleChance.X2, null]] },
    { market: "Gols", picks: [["Mais de 1.5", (pr.over["1.5"] ?? 0), null], ["Mais de 2.5", (pr.over["2.5"] ?? 0), null], ["Menos de 2.5", +(100 - (pr.over["2.5"] ?? 0)).toFixed(1), null], ["Mais de 3.5", (pr.over["3.5"] ?? 0), null]] },
    { market: "Ambas marcam", picks: [["Sim", pr.btts, null], ["Não", +(100 - pr.btts).toFixed(1), null]] },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Section title="Modelo de probabilidades" className="lg:col-span-2" right={<span className="text-xs text-muted-foreground">Poisson · gols esperados {pr.lambdaHome} x {pr.lambdaAway}</span>}>
        <div className="space-y-5">
          {rows.map((r) => (
            <div key={r.market}>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{r.market}</p>
              <div className="flex flex-wrap gap-2">
                {r.picks.map(([pick, pct, odd]) => {
                  const sel = mk(r.market, pick, pct, odd);
                  const ev = odd ? edge(pct, odd) : null;
                  return (
                    <div key={pick} className="flex items-center gap-2 rounded-md border bg-surface p-2">
                      <div className="w-24">
                        <p className="truncate text-sm">{pick}</p>
                        <p className="tabular text-lg font-bold text-primary">{pct}%</p>
                        {ev != null && <p className={cn("tabular text-[10px]", ev > 0 ? "text-win" : "text-muted-foreground")}>EV {ev > 0 ? "+" : ""}{(ev * 100).toFixed(1)}%</p>}
                      </div>
                      <OddButton sel={sel} label={odd ? (book?.provider ?? "Odd") : "Justa"} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!book?.home && <p className="text-xs text-muted-foreground">Sem odds de casa para este jogo — usando a odd justa do modelo. Veja odds reais na aba Odds.</p>}
        </div>
      </Section>
      <div className="space-y-4">
        <Section title="Placares mais prováveis">
          <div className="space-y-2">
            {pr.scores.map((s) => (
              <div key={s.score} className="flex items-center gap-3">
                <span className="tabular w-10 font-bold">{s.score}</span>
                <Bar value={s.p * 5} />
                <span className="tabular w-12 text-right text-xs text-muted-foreground">{s.p}%</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Padrões detectados">
          {[...patternsH.map((p) => ({ ...p, t: m.home.short })), ...patternsA.map((p) => ({ ...p, t: m.away.short }))].length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem padrões fortes nos últimos jogos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...patternsH.map((p) => ({ ...p, t: m.home.short })), ...patternsA.map((p) => ({ ...p, t: m.away.short }))].map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <span>
                    <b>{p.t}</b>: {p.label}
                  </span>
                  <span className={cn("tabular shrink-0 text-xs font-bold", p.strength === "forte" ? "text-primary" : "text-accent")}>{p.hits}/{p.total}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function FormBlock({ title, games }: { title: string; games: PastGame[] }) {
  const p = profile(games);
  return (
    <Section title={title}>
      <div className="mb-3 flex gap-1">{p.form.map((r, i) => <FormPill key={i} r={r} />)}</div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        {[
          ["Gols pró/j", p.gfAvg],
          ["Gols contra/j", p.gaAvg],
          ["Over 2.5", `${p.over25}%`],
          ["Ambas marcam", `${p.btts}%`],
          ["Sem sofrer", `${p.cleanSheet}%`],
          ["Vitórias", `${p.winPct}%`],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-md bg-surface p-2">
            <p className="tabular text-base font-bold">{v}</p>
            <p className="text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <GamesList games={games} />
    </Section>
  );
}

function GamesList({ games }: { games: PastGame[] }) {
  return (
    <ul className="divide-y text-sm">
      {games.map((g) => (
        <li key={g.id} className="flex items-center gap-2 py-1.5">
          <FormPill r={g.result} />
          <span className="tabular w-16 text-xs text-muted-foreground">{new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
          <span className="text-xs text-muted-foreground">{g.homeAway === "home" ? "C" : "F"}</span>
          <span className="flex-1 truncate">{g.opponent}</span>
          <span className="tabular font-semibold">{g.goalsFor}-{g.goalsAgainst}</span>
        </li>
      ))}
    </ul>
  );
}
