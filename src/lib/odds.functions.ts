import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface OddsEvent {
  id: string;
  sport: string;
  league: string;
  commence: string;
  home: string;
  away: string;
  bookmakers: {
    key: string;
    title: string;
    markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[];
  }[];
}

export const LEAGUES: { key: string; label: string }[] = [
  { key: "soccer_brazil_campeonato", label: "Brasileirão Série A" },
  { key: "soccer_brazil_serie_b", label: "Brasileirão Série B" },
  { key: "soccer_epl", label: "Premier League" },
  { key: "soccer_spain_la_liga", label: "La Liga" },
  { key: "soccer_italy_serie_a", label: "Serie A (Itália)" },
  { key: "soccer_germany_bundesliga", label: "Bundesliga" },
  { key: "soccer_france_ligue_one", label: "Ligue 1" },
  { key: "soccer_portugal_primeira_liga", label: "Liga Portugal" },
  { key: "soccer_netherlands_eredivisie", label: "Eredivisie" },
  { key: "soccer_uefa_champs_league", label: "Champions League" },
  { key: "soccer_uefa_europa_league", label: "Europa League" },
  { key: "soccer_conmebol_copa_libertadores", label: "Libertadores" },
  { key: "soccer_conmebol_copa_sudamericana", label: "Sul-Americana" },
  { key: "soccer_argentina_primera_division", label: "Argentina Primera" },
  { key: "soccer_usa_mls", label: "MLS" },
  { key: "soccer_mexico_ligamx", label: "Liga MX" },
];

export const getOdds = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ sport: z.string().regex(/^soccer_[a-z0-9_]+$/) }).parse(d))
  .handler(async ({ data }) => {
    const key = (process.env["ODDS_API_KEY"] ?? "").trim();
    if (!key) return { events: [] as OddsEvent[], error: "Chave de odds não configurada.", remaining: null as string | null };
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${data.sport}/odds`);
    url.searchParams.set("apiKey", key);
    url.searchParams.set("regions", "eu,uk");
    url.searchParams.set("markets", "h2h,totals");
    url.searchParams.set("oddsFormat", "decimal");
    const res = await fetch(url);
    const remaining = res.headers.get("x-requests-remaining");
    if (!res.ok) {
      const body = await res.text();
      console.error(`Odds API [${res.status}]: ${body}`);
      const msg =
        res.status === 401
          ? "A chave da The Odds API foi recusada. Confira se ela foi copiada corretamente."
          : res.status === 429
            ? "Limite de consultas de odds atingido. Tente mais tarde."
            : res.status === 422 || res.status === 404
              ? "Sem odds disponíveis para esta liga agora."
              : "Não foi possível carregar as odds agora.";
      return { events: [] as OddsEvent[], error: msg, remaining };
    }
    const json = (await res.json()) as Array<{
      id: string;
      sport_key: string;
      sport_title: string;
      commence_time: string;
      home_team: string;
      away_team: string;
      bookmakers: OddsEvent["bookmakers"];
    }>;
    const events: OddsEvent[] = json.map((e) => ({
      id: e.id,
      sport: e.sport_key,
      league: e.sport_title,
      commence: e.commence_time,
      home: e.home_team,
      away: e.away_team,
      bookmakers: e.bookmakers.map((b) => ({ key: b.key, title: b.title, markets: b.markets })),
    }));
    return { events, error: null as string | null, remaining };
  });
