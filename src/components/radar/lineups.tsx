import type { PlayerLine, TeamLineup } from "@/lib/espn.functions";
import { Section } from "@/components/radar/ui";

const COLS: { key: string; label: string }[] = [
  { key: "totalGoals", label: "G" },
  { key: "goalAssists", label: "A" },
  { key: "totalShots", label: "Fin" },
  { key: "shotsOnTarget", label: "NoGol" },
  { key: "foulsCommitted", label: "FC" },
  { key: "foulsSuffered", label: "FS" },
  { key: "yellowCards", label: "CA" },
  { key: "redCards", label: "CV" },
  { key: "saves", label: "Def" },
];

function Table({ players }: { players: PlayerLine[] }) {
  const cols = COLS.filter((c) => players.some((p) => (p.stats[c.key] ?? 0) > 0));
  return (
    <table className="w-full text-sm">
      <thead className="border-b text-xs uppercase text-muted-foreground">
        <tr>
          <th className="px-1 py-1 text-left">#</th>
          <th className="px-1 py-1 text-left">Jogador</th>
          <th className="px-1 py-1 text-left">Pos</th>
          {cols.map((c) => (
            <th key={c.key} className="px-1 py-1 text-right">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id + p.name} className="border-b">
            <td className="tabular px-1 py-1 text-muted-foreground">{p.jersey}</td>
            <td className="px-1 py-1">
              {p.name}
              {p.subbedOut && <span className="ml-1 text-xs text-muted-foreground">↓</span>}
              {p.subbedIn && <span className="ml-1 text-xs text-primary">↑</span>}
            </td>
            <td className="px-1 py-1 text-muted-foreground">{p.pos}</td>
            {cols.map((c) => (
              <td key={c.key} className="tabular px-1 py-1 text-right">
                {p.stats[c.key] ?? 0}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Lineups({
  lineups,
  teams,
}: {
  lineups: TeamLineup[];
  teams: { id: string; name: string }[];
}) {
  if (!lineups.some((l) => l.players.length))
    return (
      <Section title="Escalações">
        <p className="text-sm text-muted-foreground">
          As escalações aparecem perto do início da partida.
        </p>
      </Section>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {teams.map((t) => {
        const l = lineups.find((x) => x.teamId === t.id);
        if (!l) return null;
        return (
          <Section
            key={t.id}
            title={t.name}
            right={
              l.formation ? (
                <span className="tabular text-sm text-muted-foreground">{l.formation}</span>
              ) : undefined
            }
          >
            <p className="mb-1 text-xs uppercase text-muted-foreground">Titulares</p>
            <Table players={l.players.filter((p) => p.starter)} />
            {l.players.some((p) => !p.starter) && (
              <>
                <p className="mb-1 mt-4 text-xs uppercase text-muted-foreground">Banco</p>
                <Table players={l.players.filter((p) => !p.starter)} />
              </>
            )}
          </Section>
        );
      })}
    </div>
  );
}
