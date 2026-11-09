import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTeamSeason } from "@/lib/players.functions";
import type { SquadPlayer, TeamSeasonStat } from "@/lib/providers/types";
import { Section } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

const PT: Record<string, string> = {
  GOALS: "Gols",
  GOALS_CONCEDED: "Gols sofridos",
  SHOTS_TOTAL: "Finalizações",
  SHOTS_ON_TARGET: "No alvo",
  CORNERS: "Escanteios",
  YELLOWCARDS: "Amarelos",
  REDCARDS: "Vermelhos",
  FOULS: "Faltas",
  BALL_POSSESSION: "Posse (%)",
  PASSES: "Passes",
  ACCURATE_PASSES: "Passes certos",
  TACKLES: "Desarmes",
  INTERCEPTIONS: "Interceptações",
  EXPECTED_GOALS: "xG",
  WIN: "Vitórias",
  DRAW: "Empates",
  LOST: "Derrotas",
};
const GROUP_PT: Record<string, string> = {
  overall: "Geral",
  offensive: "Ataque",
  defensive: "Defesa",
  passing: "Passes",
  other: "Outros",
  home: "Mandante",
  away: "Visitante",
};

const COLS: { code: string; label: string }[] = [
  { code: "APPEARANCES", label: "J" },
  { code: "MINUTES_PLAYED", label: "Min" },
  { code: "GOALS", label: "G" },
  { code: "ASSISTS", label: "A" },
  { code: "EXPECTED_GOALS", label: "xG" },
  { code: "SHOTS_TOTAL", label: "Fin" },
  { code: "YELLOWCARDS", label: "CA" },
  { code: "REDCARDS", label: "CV" },
  { code: "SAVES", label: "Def" },
  { code: "CLEANSHEETS", label: "SG" },
  { code: "RATING", label: "Nota" },
];
const ORDER = ["GOL", "DEF", "MEI", "ATA", "—"];
const POS_LABEL: Record<string, string> = {
  GOL: "Goleiros",
  DEF: "Defensores",
  MEI: "Meio-campistas",
  ATA: "Atacantes",
  "—": "Outros",
};

function Squad({ squad }: { squad: SquadPlayer[] }) {
  const [pos, setPos] = useState<string>("todos");
  const cols = COLS.filter((c) => squad.some((p) => (p.stats[c.code] ?? 0) > 0));
  const list = squad
    .filter((p) => pos === "todos" || p.position === pos)
    .sort(
      (a, b) =>
        ORDER.indexOf(a.position) - ORDER.indexOf(b.position) ||
        (b.stats["MINUTES_PLAYED"] ?? 0) - (a.stats["MINUTES_PLAYED"] ?? 0),
    );
  const present = ORDER.filter((o) => squad.some((p) => p.position === o));
  return (
    <Section
      title="Elenco"
      right={<span className="text-xs text-muted-foreground">{squad.length} jogadores</span>}
    >
      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        {["todos", ...present].map((k) => (
          <button
            key={k}
            onClick={() => setPos(k)}
            className={cn(
              "rounded-md border px-3 py-1",
              pos === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "todos" ? "Todos" : POS_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-1 py-1 text-left">#</th>
              <th className="px-1 py-1 text-left">Jogador</th>
              <th className="px-1 py-1 text-left">Pos</th>
              <th className="px-1 py-1 text-right">Idade</th>
              {cols.map((c) => (
                <th key={c.code} className="px-1 py-1 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.playerId} className="border-b">
                <td className="tabular px-1 py-1 text-muted-foreground">{p.jersey ?? ""}</td>
                <td className="px-1 py-1">{p.name}</td>
                <td className="px-1 py-1 text-muted-foreground">{p.position}</td>
                <td className="tabular px-1 py-1 text-right">{p.age ?? "—"}</td>
                {cols.map((c) => (
                  <td key={c.code} className="tabular px-1 py-1 text-right">
                    {p.stats[c.code] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TeamStats({ stats }: { stats: TeamSeasonStat[] }) {
  const groups = new Map<string, TeamSeasonStat[]>();
  for (const s of stats) {
    const g = s.group ?? "other";
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return (
    <Section title="Estatísticas da temporada">
      <div className="grid gap-4 md:grid-cols-2">
        {[...groups.entries()].map(([g, list]) => (
          <div key={g}>
            <p className="mb-1 text-xs uppercase text-muted-foreground">{GROUP_PT[g] ?? g}</p>
            <ul className="divide-y text-sm">
              {list.map((s) => (
                <li key={s.code} className="flex items-baseline justify-between gap-2 py-1">
                  <span>{PT[s.code] ?? s.name}</span>
                  <span className="tabular font-semibold">
                    {s.value}
                    {s.average != null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {s.average}/j
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function TeamSeasonPanel({ teamName }: { teamName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["team-season", teamName],
    queryFn: () => getTeamSeason({ data: { name: teamName } }),
    staleTime: 10 * 60_000,
    enabled: !!teamName,
  });
  if (isLoading) return null;
  if (!data) return null;
  if (!data.ok)
    return data.reason === "not_configured" ? null : (
      <p className="text-xs text-muted-foreground">Elenco indisponível agora.</p>
    );
  if (!data.data) return null; // time fora do Brasileirão Série A (Sportmonks)
  return (
    <>
      {data.data.squad.length > 0 && <Squad squad={data.data.squad} />}
      {data.data.stats.length > 0 && <TeamStats stats={data.data.stats} />}
    </>
  );
}
