import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Tour } from "@/lib/tennis-model";
import { CATEGORY_PT, SURFACE_PT, type Category, type Surface } from "@/lib/tennis-surface";
import { CategoryBadge, MatchCard, PointsChart, SurfaceBadge } from "@/components/radar/tennis";
import { useTennisData } from "@/components/radar/use-tennis";
import { Section, Skeleton, StatCard, TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenis/")({
  head: () => ({
    meta: [
      { title: "Tênis — jogos, ranking, piso e probabilidade de vitória | RadarFC" },
      {
        name: "description",
        content:
          "Jogos ATP e WTA com probabilidade de vitória que considera o piso da quadra, forma recente, confronto direto e ranking.",
      },
      { property: "og:title", content: "Tênis ATP e WTA | RadarFC" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TennisPage,
});

type View = "jogos" | "ranking";
type TourSel = Tour | "all";
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE");
const CATS: (Category | "all")[] = [
  "all",
  "grand_slam",
  "masters",
  "500",
  "250",
  "finals",
  "team",
  "other",
];
const SURFS: (Surface | "all")[] = ["all", "hard", "clay", "grass"];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TennisPage() {
  const [tour, setTour] = useState<TourSel>("all");
  const [view, setView] = useState<View>("jogos");
  const [offset, setOffset] = useState(0);
  const [cat, setCat] = useState<Category | "all">("all");
  const [surf, setSurf] = useState<Surface | "all">("all");
  const [q, setQ] = useState("");
  const {
    matches,
    all,
    rankings,
    rankingsByTour,
    rankMap,
    isLoading,
    historyLoading,
    historyCount,
    error,
  } = useTennisData(tour);
  const [rankSel, setRankSel] = useState<Tour>("atp");
  const rankTour: Tour = tour === "all" ? rankSel : tour;
  const tourRank = rankingsByTour[rankTour];

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(Date.now() + (i - 3) * 86_400_000)),
    [],
  );
  const selected = dayKey(days[offset + 3]!);
  const dayMatches = useMemo(
    () => matches.filter((m) => dayKey(new Date(m.date)) === selected),
    [matches, selected],
  );
  const filtered = useMemo(
    () =>
      dayMatches.filter(
        (m) => (cat === "all" || m.category === cat) && (surf === "all" || m.surface === surf),
      ),
    [dayMatches, cat, surf],
  );
  const groups = useMemo(() => {
    const g = new Map<string, typeof filtered>();
    for (const m of filtered)
      g.set(`${m.tour}|${m.tournament}`, [...(g.get(`${m.tour}|${m.tournament}`) ?? []), m]);
    return [...g.entries()];
  }, [filtered]);
  const live = filtered.filter((m) => m.state === "in").length;
  const presentCats = new Set(dayMatches.map((m) => m.category));
  const ranking = useMemo(
    () =>
      tourRank.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 150),
    [tourRank, q],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-bold uppercase tracking-wide">
            Tênis{" "}
            <span className="text-gradient">
              {tour === "all" ? "ATP + WTA" : tour.toUpperCase()}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Probabilidade de vitória com ranking, forma, confronto direto e piso da quadra ·
            atualiza a cada 60s
          </p>
        </div>
        <div
          className="flex gap-1 rounded-lg border bg-card p-1"
          role="group"
          aria-label="Circuito"
        >
          {(
            [
              ["all", "Todos"],
              ["atp", "ATP"],
              ["wta", "WTA"],
            ] as [TourSel, string][]
          ).map(([t, l]) => (
            <button
              key={t}
              type="button"
              aria-pressed={tour === t}
              onClick={() => setTour(t)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm",
                tour === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
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
      {error && !matches.length && (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{error}</p>
      )}

      {!isLoading && !rankings.length && (
        <p
          className="rounded-lg border border-loss/40 bg-card p-3 text-sm text-muted-foreground"
          role="status"
        >
          Ranking indisponível agora: as probabilidades usam só a forma recente e o piso (e aparecem
          como n/d quando não há dados).
        </p>
      )}
      {historyLoading && (
        <p className="text-xs text-muted-foreground" role="status">
          Carregando histórico de ~6 meses para o ajuste por piso…
        </p>
      )}
      {!historyLoading && !isLoading && historyCount === 0 && (
        <p className="text-xs text-muted-foreground">
          Histórico por piso indisponível agora; a probabilidade usa só a janela recente.
        </p>
      )}

      {view === "jogos" && !isLoading && (
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

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoria do torneio">
              {CATS.filter((c) => c === "all" || presentCats.has(c)).map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {c === "all" ? "Todos os torneios" : CATEGORY_PT[c]}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Piso da quadra">
              {SURFS.map((s) => (
                <Chip key={s} active={surf === s} onClick={() => setSurf(s)}>
                  {s === "all" ? "Todos os pisos" : SURFACE_PT[s]}
                </Chip>
              ))}
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard index={0} label="Partidas" value={filtered.length} hint="simples do dia" />
              <StatCard index={1} label="Ao vivo" value={live} hint="agora" />
              <StatCard index={2} label="Torneios" value={groups.length} hint="com jogos" />
            </div>
          )}

          {!filtered.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sem partidas de simples neste dia com esses filtros.
            </p>
          )}

          {groups.map(([key, ms], gi) => {
            const first = ms[0]!;
            return (
              <section key={key} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                    {first.tournament}
                  </h2>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {first.tour}
                  </span>
                  <CategoryBadge category={first.category} />
                  <SurfaceBadge surface={first.surface} indoor={first.indoor} />
                </div>
                {ms.map((m, i) => (
                  <MatchCard key={m.id} m={m} rankMap={rankMap} all={all} index={gi + i} />
                ))}
              </section>
            );
          })}
        </>
      )}

      {view === "ranking" && tour === "all" && (
        <div
          className="flex gap-1 rounded-lg border bg-card p-1 w-fit"
          role="group"
          aria-label="Ranking de qual circuito"
        >
          {(["atp", "wta"] as Tour[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={rankSel === t}
              onClick={() => setRankSel(t)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm uppercase",
                rankSel === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {view === "ranking" && tourRank.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Section title="Pontos — top 12">
            <PointsChart rankings={tourRank} />
          </Section>
          <Section
            title={`Ranking ${rankTour.toUpperCase()} (${tourRank.length} jogadores)`}
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
                      <tr
                        key={`${r.id}-${r.points}`}
                        className="border-b transition-colors hover:bg-secondary/60"
                      >
                        <td className="tabular px-2 py-1.5">{r.rank}</td>
                        <td className="px-2 py-1.5">
                          <Link
                            to="/tenis/jogador/$id"
                            params={{ id: r.id }}
                            search={{ tour: rankTour }}
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
