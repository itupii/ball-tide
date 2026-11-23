import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getTennisHub } from "@/lib/tennis.functions";
import type { RankEntry, Tour } from "@/lib/tennis-model";
import { MatchCard, PointsChart } from "@/components/radar/tennis";
import { Section, Skeleton, StatCard, TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenis/")({
  head: () => ({
    meta: [
      { title: "Tênis — jogos, ranking e probabilidade de vitória | RadarFC" },
      {
        name: "description",
        content:
          "Jogos ATP e WTA do dia com probabilidade de vitória, forma recente, confronto direto e ranking.",
      },
      { property: "og:title", content: "Tênis ATP e WTA | RadarFC" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TennisPage,
});

type View = "jogos" | "ranking";
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");

function TennisPage() {
  const [tour, setTour] = useState<Tour>("atp");
  const [view, setView] = useState<View>("jogos");
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["tennis-hub", tour],
    queryFn: () => getTennisHub({ data: { tour } }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const matches = useMemo(() => data?.matches ?? [], [data]);
  const rankById = useMemo(
    () => new Map<string, RankEntry>((data?.rankings ?? []).map((r) => [r.id, r])),
    [data],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(Date.now() + (i - 3) * 86_400_000)),
    [],
  );
  const selected = dayKey(days[offset + 3]!);
  const dayMatches = useMemo(
    () => matches.filter((m) => dayKey(new Date(m.date)) === selected),
    [matches, selected],
  );
  const groups = useMemo(() => {
    const g = new Map<string, typeof dayMatches>();
    for (const m of dayMatches) g.set(m.tournament, [...(g.get(m.tournament) ?? []), m]);
    return [...g.entries()];
  }, [dayMatches]);
  const live = dayMatches.filter((m) => m.state === "in").length;
  const ranking = useMemo(
    () =>
      (data?.rankings ?? [])
        .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 100),
    [data, q],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-bold uppercase tracking-wide">
            Tênis <span className="text-gradient">{tour.toUpperCase()}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Probabilidade de vitória pré-jogo, forma recente e confronto direto · atualiza a cada
            60s
          </p>
        </div>
        <div
          className="flex gap-1 rounded-lg border bg-card p-1"
          role="group"
          aria-label="Circuito"
        >
          {(["atp", "wta"] as Tour[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tour === t}
              onClick={() => setTour(t)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm uppercase",
                tour === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border bg-card p-1 w-fit">
        {(
          [
            ["jogos", "Jogos"],
            ["ranking", "Ranking"],
          ] as [View, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
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

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
      {data?.error && !matches.length && !data.rankings.length && (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{data.error}</p>
      )}

      {view === "jogos" && data && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => {
              const o = i - 3;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOffset(o)}
                  className={cn(
                    "flex min-w-[4.5rem] flex-col items-center rounded-lg border px-3 py-2 text-xs transition-all hover:-translate-y-0.5",
                    offset === o
                      ? "border-primary bg-primary text-primary-foreground"
                      : "surface-card",
                  )}
                >
                  <span className="uppercase">
                    {o === 0 ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" })}
                  </span>
                  <span className="tabular text-base font-bold">
                    {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </button>
              );
            })}
          </div>

          {dayMatches.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                index={0}
                label="Partidas"
                value={dayMatches.length}
                hint="simples do dia"
              />
              <StatCard index={1} label="Ao vivo" value={live} hint="agora" />
              <StatCard index={2} label="Torneios" value={groups.length} hint="com jogos" />
            </div>
          )}

          {!dayMatches.length && !isLoading && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sem partidas de simples neste dia.
            </p>
          )}

          {groups.map(([tournament, ms], gi) => (
            <section key={tournament} className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                {tournament}
              </h2>
              {ms.map((m, i) => (
                <MatchCard key={m.id} m={m} rankById={rankById} all={matches} index={gi + i} />
              ))}
            </section>
          ))}
        </>
      )}

      {view === "ranking" && data && data.rankings.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Section title="Pontos — top 12">
            <PointsChart rankings={data.rankings} />
          </Section>
          <Section
            title={`Ranking ${tour.toUpperCase()}`}
            right={
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar jogador"
                aria-label="Buscar jogador"
                className="rounded-md border bg-card px-3 py-1 text-sm"
              />
            }
          >
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-card text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Jogador</th>
                    <th className="px-2 py-2 text-right">Pontos</th>
                    <th className="px-2 py-2 text-right">Var.</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => {
                    const d = r.previous - r.rank;
                    return (
                      <tr key={r.id} className="border-b transition-colors hover:bg-secondary/60">
                        <td className="tabular px-2 py-1.5">{r.rank}</td>
                        <td className="px-2 py-1.5">
                          <Link
                            to="/tenis/jogador/$id"
                            params={{ id: r.id }}
                            search={{ tour }}
                            className="flex items-center gap-2 hover:text-primary"
                          >
                            <TeamLogo src={r.flag} alt={r.name} size={18} />
                            {r.name}
                          </Link>
                        </td>
                        <td className="tabular px-2 py-1.5 text-right font-semibold">{r.points}</td>
                        <td
                          className={cn(
                            "tabular px-2 py-1.5 text-right",
                            d > 0 ? "text-win" : d < 0 ? "text-loss" : "text-muted-foreground",
                          )}
                        >
                          {d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
