import { useQuery } from "@tanstack/react-query";
import { getMatchXg } from "@/lib/players.functions";
import type { MatchSummary } from "@/lib/espn.functions";
import { Section } from "@/components/radar/ui";

export function MatchXgPanel({ match }: { match: Pick<MatchSummary, "date" | "home" | "away"> }) {
  const day = new Date(match.date).toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({
    queryKey: ["match-xg", day, match.home.name, match.away.name],
    queryFn: () =>
      getMatchXg({ data: { date: day, home: match.home.name, away: match.away.name } }),
    staleTime: 5 * 60_000,
  });
  const note = (t: string) => (
    <Section title="xG da partida">
      <p className="text-sm text-muted-foreground">{t}</p>
    </Section>
  );
  if (isLoading) return note("Carregando…");
  if (!data) return null;
  if (!data.ok) return note(data.message);
  const x = data.data;
  if (!x || (x.homeXg == null && x.awayXg == null))
    return note(
      "xG ainda não disponível para esta partida (sai após o apito final, com o add-on xG ativo).",
    );
  const f = (v: number | null) => (v == null ? "—" : v.toFixed(2));
  return (
    <div className="space-y-4">
      <Section title="xG da partida">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
          <div>
            <div className="tabular font-display text-4xl font-bold">{f(x.homeXg)}</div>
            <div className="text-xs text-muted-foreground">{match.home.name}</div>
          </div>
          <div className="text-xs uppercase text-muted-foreground">xG</div>
          <div>
            <div className="tabular font-display text-4xl font-bold">{f(x.awayXg)}</div>
            <div className="text-xs text-muted-foreground">{match.away.name}</div>
          </div>
        </div>
        {(x.homeXgot != null || x.awayXgot != null) && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            xG no alvo: {f(x.homeXgot)} × {f(x.awayXgot)}
          </p>
        )}
      </Section>
      {x.players.length > 0 && (
        <Section title="xG por jogador">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">Jogador</th>
                <th className="px-2 py-1 text-right">xG</th>
                <th className="px-2 py-1 text-right">xGoT</th>
              </tr>
            </thead>
            <tbody>
              {x.players.slice(0, 12).map((p) => (
                <tr key={p.playerId} className="border-b">
                  <td className="px-2 py-1">{p.name}</td>
                  <td className="tabular px-2 py-1 text-right">{f(p.xg)}</td>
                  <td className="tabular px-2 py-1 text-right">{f(p.xgot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
