import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
const STANDINGS = "https://site.web.api.espn.com/apis/v2/sports/soccer";

export const LEAGUE_OPTIONS: { slug: string; label: string }[] = [
  { slug: "bra.1", label: "Brasileirão Série A" },
  { slug: "bra.2", label: "Brasileirão Série B" },
  { slug: "conmebol.libertadores", label: "Libertadores" },
  { slug: "conmebol.sudamericana", label: "Sul-Americana" },
  { slug: "eng.1", label: "Premier League" },
  { slug: "esp.1", label: "La Liga" },
  { slug: "ita.1", label: "Serie A (ITA)" },
  { slug: "ger.1", label: "Bundesliga" },
  { slug: "fra.1", label: "Ligue 1" },
  { slug: "por.1", label: "Primeira Liga" },
  { slug: "arg.1", label: "Liga Argentina" },
  { slug: "usa.1", label: "MLS" },
  { slug: "uefa.champions", label: "Champions League" },
];

export interface LeagueRow {
  teamId: string;
  team: string;
  logo: string | null;
  group: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
  /** Texto de zona (ex.: "Libertadores", "Rebaixamento"), quando a ESPN informa */
  note: string | null;
}

async function loadStandings(data: { slug: string }) {
  try {
    const res = await fetch(`${STANDINGS}/${data.slug}/standings`, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; BallTide/1.0)",
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    const json: any = await res.json();
    const groups: any[] = json.children?.length ? json.children : [json];
    const rows: LeagueRow[] = [];
    for (const g of groups) {
      const entries: any[] = g.standings?.entries ?? [];
      entries.forEach((en, i) => {
        const v = (n: string) =>
          Number(en.stats?.find((x: any) => x.name === n || x.type === n)?.value ?? 0);
        rows.push({
          teamId: String(en.team?.id ?? ""),
          team: en.team?.displayName ?? "—",
          logo: en.team?.logos?.[0]?.href ?? null,
          group: groups.length > 1 ? (g.name ?? "") : "",
          rank: v("rank") || i + 1,
          played: v("gamesPlayed"),
          wins: v("wins"),
          draws: v("ties"),
          losses: v("losses"),
          gf: v("pointsFor"),
          ga: v("pointsAgainst"),
          points: v("points"),
          note: en.note?.description ?? null,
        });
      });
    }
    return {
      rows,
      season: json.seasons?.[0]?.displayName ?? json.season?.displayName ?? "",
      error: null as string | null,
    };
  } catch (err) {
    console.error(err);
    return {
      rows: [] as LeagueRow[],
      season: "",
      error: "Não foi possível carregar a liga agora.",
    };
  }
}

const inSchema = (d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9._-]+$/i) }).parse(d);
const standingsServer = createServerFn({ method: "GET" })
  .inputValidator(inSchema)
  .handler(({ data }) => loadStandings(data));

/* Servidor primeiro; se a fonte bloquear, tenta direto do navegador (mesmo padrão de espn.functions). */
export async function getLeague({ data }: { data: { slug: string } }) {
  const r = await standingsServer({ data }).catch(() => null);
  if (r && r.rows.length) return r;
  return typeof window !== "undefined"
    ? loadStandings(inSchema(data))
    : (r ?? loadStandings(inSchema(data)));
}
