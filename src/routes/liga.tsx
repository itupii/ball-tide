import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getLeague, LEAGUE_OPTIONS } from "@/lib/league.functions";
import { leagueSummary, teamRanks, type TeamRank } from "@/lib/league-stats";
import { getLeagueXpts } from "@/lib/players.functions";
import { sameTeam } from "@/lib/providers/names";
import { Bar, Section, StatCard, TeamLogo } from "@/components/radar/ui";
import { LeagueScatter } from "@/components/radar/interactive-charts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/liga")({
  head: () => ({
    meta: [
      { title: "Liga — classificação e rankings de times | RadarFC" },
      {
        name: "description",
        content:
          "Classificação, rankings de ataque e defesa, aproveitamento e pontos esperados dos times de cada campeonato.",
      },
      { property: "og:title", content: "Liga — rankings de times | RadarFC" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaguePage,
});

type View = "tabela" | "rankings" | "grafico";
type SortKey = keyof Pick<
  TeamRank,
  "rank" | "points" | "aproveitamento" | "gfPg" | "gaPg" | "sg" | "xPts" | "luck"
>;

const RANKS: {
  key: SortKey;
  label: string;
  asc?: boolean;
  fmt?: (n: number) => string;
  hint: string;
}[] = [
  { key: "gfPg", label: "Melhor ataque", hint: "gols pró por jogo" },
  { key: "gaPg", label: "Melhor defesa", asc: true, hint: "gols contra por jogo" },
  {
    key: "aproveitamento",
    label: "Aproveitamento",
    fmt: (n) => `${n}%`,
    hint: "% dos pontos disputados",
  },
  {
    key: "sg",
    label: "Saldo de gols",
    fmt: (n) => (n > 0 ? `+${n}` : String(n)),
    hint: "gols pró − contra",
  },
  {
    key: "luck",
    label: "Pontos − esperados",
    fmt: (n) => (n > 0 ? `+${n}` : String(n)),
    hint: "acima = rendendo além do que os gols indicam",
  },
];

function LeaguePage() {
  const [slug, setSlug] = useState("bra.1");
  const [view, setView] = useState<View>("tabela");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "rank", asc: true });
  const { data, isLoading } = useQuery({
    queryKey: ["league", slug],
    queryFn: () => getLeague({ data: { slug } }),
    staleTime: 60_000,
  });

  // xPts de verdade (Sportmonks) só para o Brasileirão Série A; nos demais fica o proxy pitagórico.
  const { data: xp } = useQuery({
    queryKey: ["league-xpts"],
    queryFn: () => getLeagueXpts(),
    enabled: slug === "bra.1",
    staleTime: 10 * 60_000,
  });
  const realXpts = slug === "bra.1" && xp?.ok && xp.data.length > 0 ? xp.data : null;
  const teams = useMemo(
    () =>
      teamRanks(data?.rows ?? []).map((t) => {
        const r = realXpts?.find((x) => sameTeam(x.team, t.team));
        return r ? { ...t, xPts: r.xPts, luck: +(t.points - r.xPts).toFixed(2) } : t;
      }),
    [data, realXpts],
  );
  const sum = useMemo(() => leagueSummary(data?.rows ?? []), [data]);
  const sorted = useMemo(
    () =>
      [...teams].sort((a, b) => (sort.asc ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key])),
    [teams, sort],
  );
  const th = (key: SortKey, label: string) => (
    <th className="px-2 py-2 text-right">
      <button
        onClick={() =>
          setSort((s) => ({ key, asc: s.key === key ? !s.asc : key === "rank" || key === "gaPg" }))
        }
        className={cn("hover:text-foreground", sort.key === key && "text-primary")}
      >
        {label}
        {sort.key === key ? (sort.asc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-md border bg-card px-3 py-2 text-sm"
        >
          {LEAGUE_OPTIONS.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {(
            [
              ["tabela", "Classificação"],
              ["rankings", "Rankings"],
              ["grafico", "Gráfico"],
            ] as [View, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm",
                view === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {data?.season && <span className="text-xs text-muted-foreground">{data.season}</span>}
      </div>

      {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>}
      {data?.error && !teams.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">{data.error}</p>
      )}

      {teams.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard index={0} label="Jogos disputados" value={sum.games} hint="na temporada" />
          <StatCard
            index={1}
            label="Gols"
            value={sum.goals}
            hint="todos os times"
            trend={[...teams].sort((x, y) => x.rank - y.rank).map((t) => t.gf)}
          />
          <StatCard
            index={2}
            label="Gols por jogo"
            value={sum.goalsPerGame}
            decimals={2}
            hint="média da liga"
          />
          <StatCard index={3} label="Empates" value={sum.drawPct} suffix="%" hint="dos jogos" />
        </div>
      )}

      {view === "tabela" && teams.length > 0 && (
        <Section title="Classificação e estatísticas">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  {th("rank", "#")}
                  <th className="px-2 py-2 text-left">Time</th>
                  {th("points", "Pts")}
                  <th className="px-2 py-2 text-right">J</th>
                  <th className="px-2 py-2 text-right">V</th>
                  <th className="px-2 py-2 text-right">E</th>
                  <th className="px-2 py-2 text-right">D</th>
                  {th("gfPg", "GP/j")}
                  {th("gaPg", "GC/j")}
                  {th("sg", "SG")}
                  {th("aproveitamento", "Aprov.")}
                  {th("xPts", realXpts ? "xPts" : "xPts*")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.group + t.teamId} className="border-b">
                    <td className="tabular px-2 py-1.5 text-right">{t.rank}</td>
                    <td className="px-2 py-1.5">
                      <Link
                        to="/time/$id"
                        params={{ id: t.teamId }}
                        className="flex items-center gap-2 hover:text-primary"
                      >
                        <TeamLogo src={t.logo} alt={t.team} size={20} />
                        {t.team}
                      </Link>
                    </td>
                    <td className="tabular px-2 py-1.5 text-right font-bold">{t.points}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.played}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.wins}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.draws}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.losses}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.gfPg}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.gaPg}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.sg}</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.aproveitamento}%</td>
                    <td className="tabular px-2 py-1.5 text-right">{t.xPts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {realXpts
              ? "xPts: pontos esperados reais (Sportmonks)."
              : "*xPts: expectativa pitagórica (expoente 1,7) sobre gols pró/contra, redistribuindo os pontos reais da liga. É um proxy; xPts de verdade precisa de xG por chute."}
          </p>
        </Section>
      )}

      {view === "grafico" && teams.length > 0 && (
        <Section title="Mapa ataque × defesa">
          <LeagueScatter teams={teams} />
        </Section>
      )}

      {view === "rankings" && teams.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {RANKS.map((r) => {
            const list = [...teams]
              .sort((a, b) => (r.asc ? a[r.key] - b[r.key] : b[r.key] - a[r.key]))
              .slice(0, 10);
            const max = Math.max(...list.map((t) => Math.abs(t[r.key])), 0.01);
            return (
              <Section
                key={r.key}
                title={r.label}
                right={<span className="text-xs text-muted-foreground">{r.hint}</span>}
              >
                <ol className="space-y-2">
                  {list.map((t, i) => (
                    <li
                      key={t.group + t.teamId}
                      className="grid grid-cols-[1.5rem_1fr_3.5rem] items-center gap-2 text-sm"
                    >
                      <span className="tabular text-muted-foreground">{i + 1}</span>
                      <div>
                        <Link
                          to="/time/$id"
                          params={{ id: t.teamId }}
                          className="mb-1 flex items-center gap-2 hover:text-primary"
                        >
                          <TeamLogo src={t.logo} alt={t.team} size={16} />
                          {t.team}
                        </Link>
                        <Bar
                          value={(Math.abs(t[r.key]) / max) * 100}
                          tone={t[r.key] < 0 ? "muted" : "primary"}
                        />
                      </div>
                      <span className="tabular text-right font-semibold">
                        {(r.fmt ?? String)(t[r.key])}
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
            );
          })}
        </div>
      )}
    </div>
  );
}
