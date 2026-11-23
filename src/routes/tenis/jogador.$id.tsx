import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getTennisAthlete, getTennisHub } from "@/lib/tennis.functions";
import {
  matchProbability,
  playerResults,
  recentForm,
  type RankEntry,
  type Tour,
} from "@/lib/tennis-model";
import { FormChart, ProbBreakdown } from "@/components/radar/tennis";
import { FormPill, Section, Skeleton, StatCard, TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenis/jogador/$id")({
  validateSearch: (s: Record<string, unknown>): { tour: Tour } => ({
    tour: s["tour"] === "wta" ? "wta" : "atp",
  }),
  head: () => ({
    meta: [
      { title: "Jogador de tênis — histórico, estatísticas e probabilidade | RadarFC" },
      {
        name: "description",
        content:
          "Ranking, forma recente, histórico de jogos, estatísticas e probabilidade de vitória no próximo jogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayerPage,
});

function PlayerPage() {
  const { id } = Route.useParams();
  const { tour } = Route.useSearch();
  const hub = useQuery({
    queryKey: ["tennis-hub", tour],
    queryFn: () => getTennisHub({ data: { tour } }),
    staleTime: 30_000,
  });
  const ath = useQuery({
    queryKey: ["tennis-athlete", tour, id],
    queryFn: () => getTennisAthlete({ data: { tour, id } }),
    staleTime: 10 * 60_000,
  });

  const matches = useMemo(() => hub.data?.matches ?? [], [hub.data]);
  const rankById = useMemo(
    () => new Map<string, RankEntry>((hub.data?.rankings ?? []).map((r) => [r.id, r])),
    [hub.data],
  );
  const rank = rankById.get(id);
  const results = useMemo(() => playerResults(matches, id), [matches, id]);
  const form = recentForm(results, 10);
  const next = useMemo(
    () => matches.find((m) => m.state !== "post" && (m.a.id === id || m.b.id === id)),
    [matches, id],
  );
  const nameFromMatches = results[0] ? null : matches.find((m) => m.a.id === id || m.b.id === id);
  const name =
    rank?.name ??
    ath.data?.profile?.name ??
    nameFromMatches?.[nameFromMatches.a.id === id ? "a" : "b"].name ??
    "Jogador";
  const flag = rank?.flag ?? null;
  const games = results.reduce((s, r) => ({ f: s.f + r.gamesFor, a: s.a + r.gamesAgainst }), {
    f: 0,
    a: 0,
  });
  const sets = results.reduce((s, r) => ({ f: s.f + r.setsFor, a: s.a + r.setsAgainst }), {
    f: 0,
    a: 0,
  });
  const wins = results.filter((r) => r.won).length;
  const p = ath.data?.profile;
  const prob = next ? matchProbability(next, rankById, matches) : null;
  const isA = next?.a.id === id;
  const opp = next ? (isA ? next.b : next.a) : null;
  const myProb = prob ? (isA ? prob.a : prob.b) : null;

  return (
    <div className="space-y-5">
      <Link to="/tenis" className="text-sm text-muted-foreground hover:text-foreground">
        ← Tênis
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <TeamLogo src={flag} alt={name} size={44} />
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {tour.toUpperCase()}
            {p?.country ? ` · ${p.country}` : ""}
            {p?.age ? ` · ${p.age} anos` : ""}
            {p?.height ? ` · ${p.height}` : ""}
            {p?.hand ? ` · ${p.hand}` : ""}
          </p>
        </div>
      </div>

      {hub.isLoading && <Skeleton className="h-24" />}

      {hub.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            index={0}
            label="Ranking"
            value={rank?.rank ?? 0}
            hint={rank ? `${rank.points} pontos` : "fora do ranking carregado"}
          />
          <StatCard
            index={1}
            label="Vitórias–derrotas"
            value={wins}
            hint={`${results.length - wins} derrotas nos últimos 14 dias`}
          />
          <StatCard
            index={2}
            label="Aproveitamento de sets"
            value={sets.f + sets.a ? Math.round((sets.f / (sets.f + sets.a)) * 100) : 0}
            suffix="%"
            hint={`${sets.f} sets ganhos, ${sets.a} perdidos`}
          />
          <StatCard
            index={3}
            label="Aproveitamento de games"
            value={games.f + games.a ? Math.round((games.f / (games.f + games.a)) * 100) : 0}
            suffix="%"
            hint={`${games.f} ganhos, ${games.a} perdidos`}
          />
        </div>
      )}

      {next && prob && opp && (
        <Section
          title="Próximo jogo e probabilidade"
          right={
            <span className="text-xs text-muted-foreground">
              {next.tournament} · {next.round}
            </span>
          }
        >
          <p className="mb-3 text-sm">
            <b>{name}</b> vs{" "}
            <Link
              to="/tenis/jogador/$id"
              params={{ id: opp.id }}
              search={{ tour }}
              className="font-semibold hover:text-primary"
            >
              {opp.name}
            </Link>{" "}
            · chance de vitória de {name.split(" ").slice(-1)[0]}:{" "}
            <b className="text-primary">{Math.round((myProb ?? 0) * 100)}%</b>
          </p>
          <ProbBreakdown prob={prob} nameA={next.a.shortName} nameB={next.b.shortName} />
        </Section>
      )}

      <Section
        title="Forma recente"
        right={
          form.n ? (
            <span className="tabular text-sm text-muted-foreground">
              {form.wins}V-{form.n - form.wins}D nos últimos {form.n}
            </span>
          ) : undefined
        }
      >
        {results.length ? (
          <div className="space-y-4">
            <div className="flex gap-1.5">
              {results.slice(0, 10).map((r) => (
                <FormPill key={r.matchId} r={r.won ? "W" : "L"} />
              ))}
            </div>
            <FormChart results={results} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem jogos encerrados nos últimos 14 dias para este jogador.
          </p>
        )}
      </Section>

      <Section title="Histórico recente">
        {results.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Data</th>
                  <th className="px-2 py-2 text-left">Torneio</th>
                  <th className="px-2 py-2 text-left">Adversário</th>
                  <th className="px-2 py-2 text-left">Resultado</th>
                  <th className="px-2 py-2 text-right">Placar</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.matchId} className="border-b transition-colors hover:bg-secondary/60">
                    <td className="tabular px-2 py-1.5 text-muted-foreground">
                      {new Date(r.date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.tournament}
                      <span className="ml-1 text-xs text-muted-foreground">{r.round}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <Link
                        to="/tenis/jogador/$id"
                        params={{ id: r.opponent.id }}
                        search={{ tour }}
                        className="hover:text-primary"
                      >
                        {r.opponent.name}
                      </Link>
                      {rankById.get(r.opponent.id) && (
                        <span className="tabular ml-1 text-xs text-muted-foreground">
                          #{rankById.get(r.opponent.id)!.rank}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn("px-2 py-1.5 font-semibold", r.won ? "text-win" : "text-loss")}
                    >
                      {r.won ? "Vitória" : "Derrota"}
                    </td>
                    <td className="tabular px-2 py-1.5 text-right">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum jogo encerrado na janela carregada.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Fonte: ESPN. O histórico mostra os últimos 14 dias do circuito; histórico de carreira
          exige uma fonte de dados dedicada.
        </p>
      </Section>

      {ath.data && ath.data.stats.length > 0 && (
        <Section title="Estatísticas da temporada">
          <ul className="grid gap-x-8 text-sm md:grid-cols-2">
            {ath.data.stats.map((s) => (
              <li
                key={s.label}
                className="flex items-baseline justify-between gap-2 border-b py-1.5"
              >
                <span className="text-muted-foreground">{s.label}</span>
                <span className="tabular font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
