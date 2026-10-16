import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getTeamHistory } from "@/lib/espn.functions";
import { findPatterns, profile } from "@/lib/analytics";
import { Bar, FormPill, Section, TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { toast } from "sonner";

const teamQuery = (id: string) => queryOptions({ queryKey: ["team", id], queryFn: () => getTeamHistory({ data: { teamId: id } }) });

export const Route = createFileRoute("/time/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(teamQuery(params.id)),
  head: ({ loaderData }) => {
    const n = loaderData?.team.name || "Time";
    const t = `${n} — padrões e estatísticas | RadarFC`;
    const d = `Histórico, médias de gols, tendências e padrões de ${n} para análise.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: TeamPage,
});

function TeamPage() {
  const { id } = Route.useParams();
  const { data } = useQuery(teamQuery(id));
  const [win, setWin] = useState(10);
  const [venue, setVenue] = useState<"all" | "home" | "away">("all");
  const { user } = useAuth();
  const qc = useQueryClient();
  const fav = useQuery({
    queryKey: ["fav", id, user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("favorite_teams").select("id").eq("team_id", id).maybeSingle()).data,
  });
  const games = useMemo(() => {
    const g = data?.games ?? [];
    return (venue === "all" ? g : g.filter((x) => x.homeAway === venue)).slice(0, win);
  }, [data, win, venue]);
  if (!data) return null;
  const p = profile(games);
  const patterns = findPatterns(data.games);

  const toggleFav = async () => {
    if (!user) {
      toast("Entre na sua conta para salvar favoritos");
      return;
    }
    if (fav.data) await supabase.from("favorite_teams").delete().eq("id", fav.data.id);
    else await supabase.from("favorite_teams").insert({ team_id: id, team_name: data.team.name, logo: data.team.logo });
    qc.invalidateQueries({ queryKey: ["fav", id] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
        <TeamLogo src={data.team.logo} alt={data.team.name} size={72} />
        <div className="flex-1">
          <h1 className="font-display text-4xl font-bold uppercase">{data.team.name}</h1>
          <p className="text-sm text-muted-foreground">{data.team.league} · {data.games.length} jogos analisados</p>
          <div className="mt-2 flex gap-1">{profile(data.games).form.map((r, i) => <FormPill key={i} r={r} />)}</div>
        </div>
        <button onClick={toggleFav} className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", fav.data && "border-accent text-accent")}>
          <Star className={cn("h-4 w-4", fav.data && "fill-current")} /> {fav.data ? "Favorito" : "Favoritar"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[5, 10, 20, 50].map((n) => (
          <button key={n} onClick={() => setWin(n)} className={cn("rounded-full border px-3 py-1 text-sm", win === n ? "border-primary text-primary" : "text-muted-foreground")}>
            Últimos {n}
          </button>
        ))}
        <span className="mx-2 border-l" />
        {(
          [
            ["all", "Todos"],
            ["home", "Casa"],
            ["away", "Fora"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setVenue(k)} className={cn("rounded-full border px-3 py-1 text-sm", venue === k ? "border-primary text-primary" : "text-muted-foreground")}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Métricas" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Gols pró / jogo", p.gfAvg],
              ["Gols contra / jogo", p.gaAvg],
              ["Pontos", `${p.points}/${p.games * 3}`],
              ["Sequência", p.streak || "—"],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-md bg-surface p-3">
                <p className="tabular text-xl font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Vitórias", p.winPct],
              ["Empates", p.drawPct],
              ["Derrotas", p.lossPct],
              ["Over 1.5", p.over15],
              ["Over 2.5", p.over25],
              ["Over 3.5", p.over35],
              ["Ambas marcam", p.btts],
              ["Sem sofrer gol", p.cleanSheet],
              ["Não marcou", p.failedToScore],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{l}</span>
                  <span className="tabular font-semibold">{v}%</span>
                </div>
                <Bar value={v as number} tone={(v as number) >= 70 ? "primary" : (v as number) >= 50 ? "accent" : "muted"} />
              </div>
            ))}
          </div>
        </Section>
        <Section title="Localizador de padrões">
          {patterns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum padrão acima de 70% encontrado.</p>
          ) : (
            <ul className="space-y-3">
              {patterns.map((pt, i) => (
                <li key={i}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{pt.label}</span>
                    <span className={cn("tabular font-bold", pt.strength === "forte" ? "text-primary" : "text-accent")}>{pt.pct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{pt.hits} de {pt.total} jogos · padrão {pt.strength}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Gols por jogo">
        <div className="flex h-32 items-end gap-1">
          {[...games].reverse().map((g) => (
            <div key={g.id} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${g.opponent} ${g.goalsFor}-${g.goalsAgainst}`}>
              <div className="w-full rounded-t-sm bg-primary" style={{ height: `${g.goalsFor * 18}px` }} />
              <div className="w-full rounded-b-sm bg-loss/70" style={{ height: `${g.goalsAgainst * 18}px` }} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Verde: gols marcados · Vermelho: gols sofridos (mais antigo → mais recente)</p>
      </Section>

      <Section title="Resultados">
        <ul className="divide-y text-sm">
          {games.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2">
              <FormPill r={g.result} />
              <span className="tabular w-20 text-xs text-muted-foreground">{new Date(g.date).toLocaleDateString("pt-BR")}</span>
              <span className="w-6 text-xs text-muted-foreground">{g.homeAway === "home" ? "C" : "F"}</span>
              <TeamLogo src={g.opponentLogo} alt={g.opponent} size={18} />
              <span className="flex-1 truncate">{g.opponent}</span>
              <span className="tabular font-bold">{g.goalsFor}-{g.goalsAgainst}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
