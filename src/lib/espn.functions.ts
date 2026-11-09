import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function espn(path: string): Promise<any> {
  const headers = {
    accept: "application/json, text/plain, */*",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    origin: "https://www.espn.com",
    referer: "https://www.espn.com/",
  };
  const hosts = [BASE, "https://site.web.api.espn.com/apis/site/v2/sports/soccer"];
  let last = 0;
  for (const h of hosts) {
    for (const p of [path, path.replace(/&limit=\d+/, "")]) {
      try {
        const res = await fetch(
          `${h}${p}`,
          typeof window === "undefined" ? { headers } : undefined,
        );
        if (res.ok) return res.json();
        last = res.status;
      } catch {
        last = -1;
      }
    }
  }
  throw new Error(`Fonte de dados indisponível (${last})`);
}

export type MatchState = "pre" | "in" | "post";

export interface TeamSide {
  id: string;
  name: string;
  short: string;
  abbr: string;
  logo: string | null;
  score: number | null;
  form: string | null;
  record: string | null;
  winner: boolean;
}

export interface MatchEvent {
  minute: string;
  type: string;
  teamId: string | null;
  player: string | null;
  goal: boolean;
  yellow: boolean;
  red: boolean;
  penalty: boolean;
  ownGoal: boolean;
}

export interface MatchSummary {
  id: string;
  date: string;
  state: MatchState;
  status: string;
  clock: string;
  league: string;
  leagueSlug: string;
  home: TeamSide;
  away: TeamSide;
  events: MatchEvent[];
  venue: string | null;
  odds: {
    provider: string;
    home: number | null;
    draw: number | null;
    away: number | null;
    overUnder: number | null;
  } | null;
}

function americanToDecimal(v: any): number | null {
  const n =
    typeof v === "string" ? parseFloat(v.replace("+", "")) : typeof v === "number" ? v : NaN;
  if (!isFinite(n) || n === 0) return null;
  return +(n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n)).toFixed(2);
}

function side(c: any): TeamSide {
  const t = c?.team ?? {};
  const s = c?.score;
  const score =
    s == null ? null : typeof s === "object" ? Number(s.value ?? s.displayValue) : Number(s);
  return {
    id: String(t.id ?? ""),
    name: t.displayName ?? t.name ?? "—",
    short: t.shortDisplayName ?? t.displayName ?? "—",
    abbr: t.abbreviation ?? "",
    logo: t.logo ?? t.logos?.[0]?.href ?? null,
    score: Number.isFinite(score) ? score : null,
    form: c?.form ?? null,
    record: c?.records?.[0]?.summary ?? null,
    winner: !!c?.winner,
  };
}

function normEvents(details: any[] | undefined): MatchEvent[] {
  return (details ?? []).map((d) => ({
    minute: d.clock?.displayValue ?? "",
    type: d.type?.text ?? "",
    teamId: d.team?.id ? String(d.team.id) : null,
    player: d.athletesInvolved?.[0]?.displayName ?? null,
    goal: !!d.scoringPlay,
    yellow: !!d.yellowCard,
    red: !!d.redCard,
    penalty: !!d.penaltyKick,
    ownGoal: !!d.ownGoal,
  }));
}

function normOdds(o: any) {
  if (!o) return null;
  const ml = o.moneyline;
  const home = americanToDecimal(
    ml?.home?.close?.odds ?? ml?.home?.open?.odds ?? o.homeTeamOdds?.moneyLine,
  );
  const away = americanToDecimal(
    ml?.away?.close?.odds ?? ml?.away?.open?.odds ?? o.awayTeamOdds?.moneyLine,
  );
  const draw = americanToDecimal(
    ml?.draw?.close?.odds ?? ml?.draw?.open?.odds ?? o.drawOdds?.moneyLine,
  );
  if (!home && !away && !draw && o.overUnder == null) return null;
  return { provider: o.provider?.name ?? "ESPN", home, draw, away, overUnder: o.overUnder ?? null };
}

function normalizeEvent(e: any, leagueFallback?: { name: string; slug: string }): MatchSummary {
  const comp = e.competitions?.[0] ?? {};
  const cs = comp.competitors ?? [];
  const home = cs.find((c: any) => c.homeAway === "home") ?? cs[0];
  const away = cs.find((c: any) => c.homeAway === "away") ?? cs[1];
  const st = e.status ?? comp.status ?? {};
  return {
    id: String(e.id),
    date: e.date,
    state: (st.type?.state ?? "pre") as MatchState,
    status: st.type?.shortDetail ?? st.type?.description ?? "",
    clock: st.displayClock ?? "",
    league: e.league?.name ?? leagueFallback?.name ?? e.season?.slug ?? "",
    leagueSlug: e.league?.slug ?? leagueFallback?.slug ?? "",
    home: side(home),
    away: side(away),
    events: normEvents(comp.details),
    venue: comp.venue?.fullName ?? null,
    odds: normOdds(comp.odds?.[0]),
  };
}

function leagueFromLink(e: any): { name: string; slug: string } {
  // ESPN "all" scoreboard omits league per event; derive from the season/uid when possible.
  const uid: string = e.uid ?? "";
  const m = uid.match(/l:(\d+)/);
  return { name: e.season?.slug ? "" : "", slug: m?.[1] ?? "" };
}

async function loadScoreboard(data: { date: string }) {
  try {
    const [json, dd] = await Promise.all([
      espn(`/all/scoreboard?dates=${data.date}&limit=500`),
      fetch("https://site.web.api.espn.com/apis/site/v2/leagues/dropdown?sport=soccer&limit=500")
        .then((r) => (r.ok ? r.json() : { leagues: [] }))
        .catch(() => ({ leagues: [] })),
    ]);
    const leagues: Record<string, { name: string; slug: string }> = {};
    for (const l of [...(dd.leagues ?? []), ...(json.leagues ?? [])])
      leagues[String(l.id)] = { name: l.name, slug: l.slug };
    const matches: MatchSummary[] = (json.events ?? []).map((e: any) => {
      const lid = (e.uid ?? "").match(/l:(\d+)/)?.[1];
      const lg = lid ? leagues[lid] : undefined;
      const n = normalizeEvent(e, lg ?? leagueFromLink(e));
      return n;
    });
    return { matches, error: null as string | null, fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error(err);
    return {
      matches: [] as MatchSummary[],
      error: "Não foi possível carregar os jogos agora.",
      fetchedAt: new Date().toISOString(),
    };
  }
}

export interface TeamStatLine {
  key: string;
  label: string;
  home: string;
  away: string;
}
export interface PastGame {
  id: string;
  date: string;
  opponent: string;
  opponentLogo: string | null;
  homeAway: "home" | "away";
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  competition: string;
  // team discipline/attack stats for this game (undefined when unavailable)
  corners?: number | undefined;
  cornersAgainst?: number | undefined;
  fouls?: number | undefined;
  yellows?: number | undefined;
  reds?: number | undefined;
  shots?: number | undefined;
  shotsOnTarget?: number | undefined;
  possession?: number | undefined;
  offsides?: number | undefined;
  saves?: number | undefined;
}
export interface StandingRow {
  teamId: string;
  team: string;
  logo: string | null;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
}

const STAT_LABELS: Record<string, string> = {
  possessionPct: "Posse de bola (%)",
  totalShots: "Finalizações",
  shotsOnTarget: "Chutes no gol",
  blockedShots: "Chutes bloqueados",
  wonCorners: "Escanteios",
  foulsCommitted: "Faltas",
  yellowCards: "Cartões amarelos",
  redCards: "Cartões vermelhos",
  offsides: "Impedimentos",
  saves: "Defesas",
  totalPasses: "Passes",
  accuratePasses: "Passes certos",
  passPct: "Precisão de passe",
  totalCrosses: "Cruzamentos",
  totalLongBalls: "Bolas longas",
  totalTackles: "Desarmes",
  interceptions: "Interceptações",
  totalClearance: "Cortes",
};

function parsePastGames(block: any, teamId: string): PastGame[] {
  return (block?.events ?? []).map((g: any) => {
    const isHome = String(g.homeTeamId) === teamId;
    const hs = Number(g.homeTeamScore ?? 0);
    const as = Number(g.awayTeamScore ?? 0);
    const gf = isHome ? hs : as;
    const ga = isHome ? as : hs;
    return {
      id: String(g.id),
      date: g.gameDate,
      opponent: g.opponent?.displayName ?? "—",
      opponentLogo: g.opponentLogo ?? g.opponent?.logo ?? null,
      homeAway: isHome ? "home" : "away",
      goalsFor: gf,
      goalsAgainst: ga,
      result: gf > ga ? "W" : gf < ga ? "L" : "D",
      competition: g.leagueAbbreviation ?? g.leagueName ?? "",
    } as PastGame;
  });
}

export interface PlayerLine {
  id: string;
  name: string;
  jersey: string;
  pos: string;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  stats: Record<string, number>;
}
export interface TeamLineup {
  teamId: string;
  formation: string | null;
  players: PlayerLine[];
}
export type PitchKind = "shot" | "goal" | "other";
export interface PitchEvent {
  id: string;
  teamId: string | null;
  player: string | null;
  minute: string;
  type: string;
  kind: PitchKind;
  outcome: "goal" | "on_target" | "blocked" | "off_target" | "other";
  /** 0-100, comprimento do campo (0 = gol do mandante, 100 = gol do visitante) */
  x: number;
  /** 0-100, largura do campo */
  y: number;
}

function parseLineups(s: any): TeamLineup[] {
  return ((s.rosters ?? []) as any[]).map((r) => ({
    teamId: String(r.team?.id ?? ""),
    formation:
      typeof r.formation === "string"
        ? r.formation
        : (r.formation?.summary ?? r.formation?.name ?? null),
    players: ((r.roster ?? []) as any[]).map((p) => {
      const stats: Record<string, number> = {};
      for (const st of p.stats ?? []) {
        const v = Number(st.value ?? st.displayValue);
        if (st.name && Number.isFinite(v)) stats[st.name] = v;
      }
      return {
        id: String(p.athlete?.id ?? p.id ?? ""),
        name: p.athlete?.displayName ?? p.athlete?.fullName ?? "—",
        jersey: String(p.jersey ?? p.athlete?.jersey ?? ""),
        pos: p.position?.abbreviation ?? p.athlete?.position?.abbreviation ?? "",
        starter: !!p.starter,
        subbedIn: !!p.subbedIn,
        subbedOut: !!p.subbedOut,
        stats,
      } as PlayerLine;
    }),
  }));
}

/* Coordenadas de lances: a ESPN só envia posição em alguns campeonatos/jogos.
   Quando não vier, a lista fica vazia e a aba "Mapas" avisa que não há coordenadas. */
function parsePitchEvents(s: any): PitchEvent[] {
  const plays: any[] = [
    ...(s.plays ?? []),
    ...((s.commentary ?? []) as any[]).map((c) => c.play).filter(Boolean),
  ];
  const norm = (v: number) => (Math.abs(v) <= 1 ? v * 100 : v);
  const out: PitchEvent[] = [];
  plays.forEach((p, i) => {
    const px = Number(p.fieldPositionX ?? p.fieldPosition?.x ?? p.coordinate?.x);
    const py = Number(p.fieldPositionY ?? p.fieldPosition?.y ?? p.coordinate?.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const type: string = p.type?.text ?? p.text ?? "";
    const isShot = /shot|goal|penalty/i.test(type) && !/kick|offside|card/i.test(type);
    const outcome =
      /goal/i.test(type) && !/no goal|disallowed/i.test(type)
        ? "goal"
        : /block/i.test(type)
          ? "blocked"
          : /on target|saved|save/i.test(type)
            ? "on_target"
            : /off target|wide|over|high|post|bar/i.test(type)
              ? "off_target"
              : "other";
    out.push({
      id: String(p.id ?? i),
      teamId: p.team?.id ? String(p.team.id) : null,
      player: p.participants?.[0]?.athlete?.displayName ?? null,
      minute: p.clock?.displayValue ?? "",
      type,
      kind: outcome === "goal" ? "goal" : isShot ? "shot" : "other",
      outcome,
      x: Math.max(0, Math.min(100, norm(px))),
      y: Math.max(0, Math.min(100, norm(py))),
    });
  });
  return out;
}

async function loadMatch(data: { id: string }) {
  const s = await espn(`/all/summary?event=${data.id}`);
  const header = s.header ?? {};
  const comp = header.competitions?.[0] ?? {};
  const base = normalizeEvent(
    {
      ...header,
      date: comp.date ?? header.date,
      status: comp.status,
      competitions: [
        {
          ...comp,
          details:
            comp.details ??
            s.keyEvents
              ?.filter((k: any) => k.scoringPlay || /card/i.test(k.type?.text ?? ""))
              .map((k: any) => ({
                ...k,
                athletesInvolved: k.participants?.map((p: any) => p.athlete),
              })),
        },
      ],
    },
    { name: header.league?.name ?? "", slug: header.league?.slug ?? "" },
  );
  if (!comp.details && s.keyEvents) {
    base.events = (s.keyEvents as any[])
      .filter((k) => k.scoringPlay || /card|penalty/i.test(k.type?.text ?? ""))
      .map((k) => ({
        minute: k.clock?.displayValue ?? "",
        type: k.type?.text ?? "",
        teamId: k.team?.id ? String(k.team.id) : null,
        player: k.participants?.[0]?.athlete?.displayName ?? null,
        goal: !!k.scoringPlay,
        yellow: /yellow/i.test(k.type?.text ?? ""),
        red: /red/i.test(k.type?.text ?? ""),
        penalty: /penalty/i.test(k.type?.text ?? ""),
        ownGoal: /own/i.test(k.type?.text ?? ""),
      }));
  }

  // team stats
  const bt: any[] = s.boxscore?.teams ?? [];
  const hStats = bt.find((t) => String(t.team?.id) === base.home.id)?.statistics ?? [];
  const aStats = bt.find((t) => String(t.team?.id) === base.away.id)?.statistics ?? [];
  const stats: TeamStatLine[] = hStats
    .filter((st: any) => STAT_LABELS[st.name])
    .map((st: any) => ({
      key: st.name,
      label: STAT_LABELS[st.name],
      home: st.displayValue,
      away: aStats.find((x: any) => x.name === st.name)?.displayValue ?? "-",
    }));

  // last five
  const lf: any[] = s.lastFiveGames ?? [];
  const homeLast = parsePastGames(
    lf.find((b) => String(b.team?.id) === base.home.id),
    base.home.id,
  );
  const awayLast = parsePastGames(
    lf.find((b) => String(b.team?.id) === base.away.id),
    base.away.id,
  );

  // h2h
  const h2hBlock = (s.headToHeadGames ?? [])[0];
  const h2h = parsePastGames(h2hBlock, String(h2hBlock?.team?.id ?? base.home.id));

  // standings
  const entries: any[] = s.standings?.groups?.[0]?.standings?.entries ?? [];
  const standings: StandingRow[] = entries.map((en: any, i: number) => {
    const g = (n: string) =>
      Number(en.stats?.find((x: any) => x.name === n || x.type === n)?.value ?? 0);
    return {
      teamId: String(en.id ?? en.team?.id ?? ""),
      team: en.team?.displayName ?? en.team ?? "—",
      logo: en.logo?.[0]?.href ?? null,
      rank: g("rank") || i + 1,
      played: g("gamesPlayed"),
      wins: g("wins"),
      draws: g("ties"),
      losses: g("losses"),
      gf: g("pointsFor"),
      ga: g("pointsAgainst"),
      points: g("points"),
    };
  });

  const pc = (s.pickcenter ?? [])[0];
  const odds = normOdds(pc) ?? base.odds;

  return {
    match: { ...base, odds },
    stats,
    homeLast,
    awayLast,
    h2h,
    standings,
    lineups: parseLineups(s),
    pitchEvents: parsePitchEvents(s),
    fetchedAt: new Date().toISOString(),
  };
}

async function loadTeamHistory(data: { teamId: string }) {
  const out: {
    team: { id: string; name: string; logo: string | null; league: string };
    games: PastGame[];
  } = {
    team: { id: data.teamId, name: "", logo: null, league: "" },
    games: [],
  };
  const year = new Date().getUTCFullYear();
  const seasons = [String(year), String(year - 1)];
  const seen = new Set<string>();
  for (const season of seasons) {
    try {
      const j = await espn(`/all/teams/${data.teamId}/schedule?season=${season}`);
      if (!out.team.name) {
        out.team = {
          id: data.teamId,
          name: j.team?.displayName ?? "",
          logo: j.team?.logo ?? j.team?.logos?.[0]?.href ?? null,
          league: j.season?.displayName ?? "",
        };
      }
      for (const e of j.events ?? []) {
        const c = e.competitions?.[0];
        if (!c?.status?.type?.completed || seen.has(String(e.id))) continue;
        seen.add(String(e.id));
        const me = c.competitors.find((x: any) => String(x.id ?? x.team?.id) === data.teamId);
        const op = c.competitors.find((x: any) => String(x.id ?? x.team?.id) !== data.teamId);
        if (!me || !op) continue;
        const gf = Number(me.score?.value ?? me.score ?? 0);
        const ga = Number(op.score?.value ?? op.score ?? 0);
        out.games.push({
          id: String(e.id),
          date: e.date,
          opponent: op.team?.displayName ?? "—",
          opponentLogo: op.team?.logos?.[0]?.href ?? op.team?.logo ?? null,
          homeAway: me.homeAway,
          goalsFor: gf,
          goalsAgainst: ga,
          result: gf > ga ? "W" : gf < ga ? "L" : "D",
          competition: e.league?.abbreviation ?? e.seasonType?.name ?? "",
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
  out.games.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // Enrich the most recent games with per-game team stats (corners, fouls, cards…)
  const statNum = (list: any[], name: string): number | undefined => {
    const st = list.find((x: any) => x.name === name);
    const v = st?.value ?? parseFloat(String(st?.displayValue ?? "").replace(",", "."));
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  const enrich = async (g: PastGame) => {
    try {
      const s = await espn(`/all/summary?event=${g.id}`);
      const teams: any[] = s.boxscore?.teams ?? [];
      const mine = teams.find((t) => String(t.team?.id) === data.teamId)?.statistics ?? [];
      const opp = teams.find((t) => String(t.team?.id) !== data.teamId)?.statistics ?? [];
      if (!mine.length) return;
      g.corners = statNum(mine, "wonCorners");
      g.cornersAgainst = statNum(opp, "wonCorners");
      g.fouls = statNum(mine, "foulsCommitted");
      g.yellows = statNum(mine, "yellowCards");
      g.reds = statNum(mine, "redCards");
      g.shots = statNum(mine, "totalShots");
      g.shotsOnTarget = statNum(mine, "shotsOnTarget");
      g.possession = statNum(mine, "possessionPct");
      g.offsides = statNum(mine, "offsides");
      g.saves = statNum(mine, "saves");
    } catch {
      /* keep game without extra stats */
    }
  };
  const recent = out.games.slice(0, 10);
  for (let i = 0; i < recent.length; i += 5) {
    await Promise.all(recent.slice(i, i + 5).map(enrich));
  }
  return out;
}

/* Server first; if the data source blocks the server, read it straight from the browser. */
const sbIn = (d: unknown) => z.object({ date: z.string().regex(/^\d{8}$/) }).parse(d);
const mIn = (d: unknown) => z.object({ id: z.string().regex(/^\d+$/) }).parse(d);
const tIn = (d: unknown) => z.object({ teamId: z.string().regex(/^\d+$/) }).parse(d);
const scoreboardServer = createServerFn({ method: "GET" })
  .inputValidator(sbIn)
  .handler(({ data }) => loadScoreboard(data));
const matchServer = createServerFn({ method: "GET" })
  .inputValidator(mIn)
  .handler(({ data }) => loadMatch(data));
const teamServer = createServerFn({ method: "GET" })
  .inputValidator(tIn)
  .handler(({ data }) => loadTeamHistory(data));
const inBrowser = () => typeof window !== "undefined";

export async function getScoreboard({ data }: { data: { date: string } }) {
  const r = await scoreboardServer({ data }).catch(() => null);
  if (r && !r.error && r.matches.length) return r;
  return inBrowser() ? loadScoreboard(sbIn(data)) : (r ?? loadScoreboard(sbIn(data)));
}
export async function getMatch({ data }: { data: { id: string } }) {
  try {
    return await matchServer({ data });
  } catch (e) {
    if (!inBrowser()) throw e;
    return loadMatch(mIn(data));
  }
}
export async function getTeamHistory({ data }: { data: { teamId: string } }) {
  const r = await teamServer({ data }).catch(() => null);
  if (r && r.games.length) return r;
  return inBrowser() ? loadTeamHistory(tIn(data)) : (r ?? loadTeamHistory(tIn(data)));
}
