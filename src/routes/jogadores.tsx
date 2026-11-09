import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTopPlayers } from "@/lib/players.functions";
import { Bar, Section, Skeleton } from "@/components/radar/ui";
import { PlayerBars } from "@/components/radar/interactive-charts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jogadores")({
  head: () => ({
    meta: [
      { title: "Jogadores — artilharia, assistências e xG | RadarFC" },
      {
        name: "description",
        content: "Ranking de jogadores do Brasileirão: gols, assistências e xG da temporada.",
      },
      { property: "og:title", content: "Jogadores do Brasileirão | RadarFC" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayersPage,
});

type Metric = "goals" | "assists";

function PlayersPage() {
  const [metric, setMetric] = useState<Metric>("goals");
  const { data, isLoading } = useQuery({
    queryKey: ["players", metric],
    queryFn: () => getTopPlayers({ data: { metric } }),
    staleTime: 5 * 60_000,
  });
  const rows = data?.ok ? data.data : [];
  const max = Math.max(...rows.map((r) => r.value), 1);
  const hasXg = rows.some((r) => r.xg != null);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg border bg-card p-1 w-fit">
        {(
          [
            ["goals", "Artilharia"],
            ["assists", "Assistências"],
          ] as [Metric, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setMetric(k)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm",
              metric === k
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
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}
      {data && !data.ok && (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {data.message}
        </p>
      )}

      {rows.length > 0 && (
        <Section
          title={metric === "goals" ? "Artilharia do Brasileirão" : "Líderes de assistências"}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Jogador</th>
                  <th className="px-2 py-2 text-left">Time</th>
                  <th className="w-40 px-2 py-2 text-left">
                    {metric === "goals" ? "Gols" : "Assist."}
                  </th>
                  {hasXg && <th className="px-2 py-2 text-right">xG</th>}
                  {hasXg && <th className="px-2 py-2 text-right">G − xG</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.playerId} className="border-b transition-colors hover:bg-secondary/60">
                    <td className="tabular px-2 py-1.5">{r.position}</td>
                    <td className="px-2 py-1.5 font-medium">{r.name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.team}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="tabular w-6 font-bold">{r.value}</span>
                        <div className="flex-1">
                          <Bar value={(r.value / max) * 100} />
                        </div>
                      </div>
                    </td>
                    {hasXg && <td className="tabular px-2 py-1.5 text-right">{r.xg ?? "—"}</td>}
                    {hasXg && (
                      <td
                        className={cn(
                          "tabular px-2 py-1.5 text-right",
                          r.xg != null &&
                            (r.value - r.xg > 0 ? "text-primary" : "text-muted-foreground"),
                        )}
                      >
                        {r.xg != null
                          ? (r.value - r.xg > 0 ? "+" : "") + (r.value - r.xg).toFixed(1)
                          : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Fonte: Sportmonks. xG dos 15 primeiros artilheiros (requer o add-on xG).
          </p>
        </Section>
      )}
    </div>
  );
}
