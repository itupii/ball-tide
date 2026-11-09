/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  MatchXg,
  PlayerRank,
  ProviderInfo,
  SquadPlayer,
  StatsProvider,
  TeamSeason,
  TeamSeasonStat,
  TeamXpts,
} from "./types";
import { sameTeam } from "./names";

const BASE = "https://api.sportmonks.com/v3/football";
/** ID da Série A brasileira na Sportmonks (confirme no Coverage Finder da sua conta). */
export const BRASILEIRAO_LEAGUE_ID = 648;
/** Tipos de estatística (docs Sportmonks). Confirme assists/cartões em GET /v3/core/types. */
const TYPE = { xg: 5304, xgot: 5305, xpts: 7939 };
const TOPSCORER_TYPE = { goals: 208, assists: 209 } as const;

export const sportmonksConfigured = () => !!process.env["SPORTMONKS_API_TOKEN"];

async function sm(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const token = process.env["SPORTMONKS_API_TOKEN"];
  if (!token) throw new Error("SPORTMONKS_API_TOKEN não configurado");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sportmonks ${res.status} em ${path}`);
  return res.json();
}

/* ---------- parsers puros (testáveis sem rede) ---------- */

export function parseSeasonId(json: any): number | null {
  const s = json?.data?.currentseason ?? json?.data?.currentSeason;
  return s?.id ? Number(s.id) : null;
}

export function parseTopscorers(json: any): PlayerRank[] {
  return ((json?.data ?? []) as any[]).map((r, i) => ({
    position: Number(r.position ?? i + 1),
    playerId: Number(r.player_id ?? r.player?.id),
    name: r.player?.display_name ?? r.player?.common_name ?? r.player?.name ?? "—",
    teamId: r.participant_id ? Number(r.participant_id) : null,
    team: r.participant?.name ?? "—",
    value: Number(r.total ?? 0),
  }));
}

/** xG de temporada de um jogador: players/{id}?include=statistics.details.type */
export function parsePlayerSeasonXg(json: any): number | null {
  for (const st of (json?.data?.statistics ?? []) as any[]) {
    const d = (st.details ?? []).find((x: any) => Number(x.type_id) === TYPE.xg);
    const v = d?.value?.expected;
    if (typeof v === "number") return +v.toFixed(2);
  }
  return null;
}

export function parseXpts(json: any): TeamXpts[] {
  const out: TeamXpts[] = [];
  for (const row of (json?.data ?? []) as any[]) {
    const d = (row.details ?? []).find((x: any) => Number(x.type_id) === TYPE.xpts);
    if (d && typeof d.value === "number") {
      out.push({
        teamId: Number(row.participant_id),
        team: row.participant?.name ?? "—",
        xPts: +Number(d.value).toFixed(2),
      });
    }
  }
  return out;
}

const xgOf = (list: any[] | undefined, type: number, match: (x: any) => boolean): number | null => {
  const e = (list ?? []).find((x) => Number(x.type_id) === type && match(x));
  return typeof e?.data?.value === "number" ? +e.data.value.toFixed(2) : null;
};

export function parseMatchXg(json: any): MatchXg | null {
  const f = json?.data;
  if (!f) return null;
  const parts: any[] = f.participants ?? [];
  const home = parts.find((p) => p.meta?.location === "home");
  const away = parts.find((p) => p.meta?.location === "away");
  const teamXg = (id: number | undefined, type: number) =>
    xgOf(f.expected, type, (x) => Number(x.participant_id) === id);
  const players = ((f.lineups ?? []) as any[])
    .map((l) => ({
      playerId: Number(l.player_id),
      name: String(l.player_name ?? "—"),
      teamId: Number(l.team_id),
      xg: xgOf(l.expected, TYPE.xg, () => true),
      xgot: xgOf(l.expected, TYPE.xgot, () => true),
    }))
    .filter((p) => p.xg !== null || p.xgot !== null)
    .sort((a, b) => (b.xg ?? 0) - (a.xg ?? 0));
  return {
    fixtureId: Number(f.id),
    homeXg: teamXg(Number(home?.id), TYPE.xg),
    awayXg: teamXg(Number(away?.id), TYPE.xg),
    homeXgot: teamXg(Number(home?.id), TYPE.xgot),
    awayXgot: teamXg(Number(away?.id), TYPE.xgot),
    players,
  };
}

/** Extrai um número de formatos variados de valor da Sportmonks ({total}, {average}, {expected}, {all:{count}}, número). */
export function statNumber(v: any): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    for (const x of [
      v.total,
      v.expected,
      v.count,
      v.all?.count,
      v.all?.total,
      v.average,
      v.all?.average,
    ])
      if (typeof x === "number") return x;
  }
  return null;
}

const POS: Record<number, SquadPlayer["position"]> = { 24: "GOL", 25: "DEF", 26: "MEI", 27: "ATA" };

export function parseSquad(json: any): SquadPlayer[] {
  const now = Date.now();
  return ((json?.data ?? []) as any[])
    .map((e) => {
      const stats: Record<string, number> = {};
      for (const d of e.details ?? []) {
        const code = d.type?.developer_name;
        const n = statNumber(d.value);
        if (code && n !== null) stats[code] = +n.toFixed(2);
      }
      const dob = e.player?.date_of_birth ? Date.parse(e.player.date_of_birth) : NaN;
      return {
        playerId: Number(e.player_id ?? e.player?.id),
        name: e.player?.display_name ?? e.player?.common_name ?? e.player?.name ?? "—",
        jersey: e.jersey_number != null ? Number(e.jersey_number) : null,
        position: POS[Number(e.position_id ?? e.player?.position_id)] ?? "—",
        age: Number.isFinite(dob) ? Math.floor((now - dob) / (365.25 * 24 * 3600 * 1000)) : null,
        stats,
      } as SquadPlayer;
    })
    .filter((p) => Number.isFinite(p.playerId));
}

export function parseTeamStats(json: any): TeamSeasonStat[] {
  const details: any[] = json?.data?.statistics?.[0]?.details ?? [];
  return details
    .map((d) => {
      const v = d.value;
      const average =
        typeof v?.all?.average === "number"
          ? v.all.average
          : typeof v?.average === "number"
            ? v.average
            : null;
      return {
        code: String(d.type?.developer_name ?? d.type_id),
        name: String(d.type?.name ?? d.type_id),
        group: d.type?.stat_group ?? null,
        value: statNumber(v),
        average: average !== null ? +average.toFixed(2) : null,
      } as TeamSeasonStat;
    })
    .filter((s) => s.value !== null);
}

const memo = new Map<string, { t: number; v: any }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const v = await fn();
  memo.set(key, { t: Date.now(), v });
  return v;
}

/* ---------- chamadas ---------- */

async function seasonId(): Promise<number> {
  const id = parseSeasonId(
    await sm(`/leagues/${BRASILEIRAO_LEAGUE_ID}`, { include: "currentSeason" }),
  );
  if (!id) throw new Error("Temporada atual não encontrada");
  return id;
}

export const sportmonks: StatsProvider = {
  info(): ProviderInfo {
    return {
      id: "sportmonks",
      label: "Sportmonks",
      configured: sportmonksConfigured(),
      capabilities: [
        "playerSeasonStats",
        "lineups",
        "playerXg",
        "teamXg",
        "xPts",
        "teamSeasonStats",
        "squad",
      ],
    };
  },

  async topPlayers(metric) {
    const sid = await seasonId();
    const json = await sm(`/topscorers/seasons/${sid}`, {
      include: "player;participant;type",
      filters: `seasontopscorerTypes:${TOPSCORER_TYPE[metric]}`,
      order: "desc",
      per_page: 25,
    });
    const rows = parseTopscorers(json);
    if (metric !== "goals") return rows;
    // xG de temporada dos artilheiros (precisa do add-on xG; falhas viram null)
    await Promise.all(
      rows.slice(0, 15).map(async (r) => {
        try {
          const p = await sm(`/players/${r.playerId}`, {
            include: "statistics.details.type",
            filters: `teamStatisticSeasons:${sid}`,
          });
          r.xg = parsePlayerSeasonXg(p);
        } catch {
          r.xg = null;
        }
      }),
    );
    return rows;
  },

  async matchXg({ date, home, away }) {
    const day = await sm(`/fixtures/date/${date}`, { include: "participants" });
    const fx = ((day.data ?? []) as any[]).find((f) => {
      const h = f.participants?.find((p: any) => p.meta?.location === "home")?.name ?? "";
      const a = f.participants?.find((p: any) => p.meta?.location === "away")?.name ?? "";
      return sameTeam(h, home) && sameTeam(a, away);
    });
    if (!fx) return null;
    return parseMatchXg(
      await sm(`/fixtures/${fx.id}`, { include: "participants;xGFixture;lineups.xGLineup" }),
    );
  },

  async teamSeason(teamName) {
    const sid = await seasonId();
    const teams = await cached(
      `teams:${sid}`,
      6 * 3600_000,
      async () => ((await sm(`/teams/seasons/${sid}`, { per_page: 50 })).data ?? []) as any[],
    );
    const t = teams.find((x) => sameTeam(String(x.name), teamName));
    if (!t) return null;
    const [squad, stats] = await Promise.all([
      cached(`squad:${sid}:${t.id}`, 15 * 60_000, async () =>
        parseSquad(
          await sm(`/squads/seasons/${sid}/teams/${t.id}`, { include: "player;details.type" }),
        ),
      ),
      cached(`tstats:${sid}:${t.id}`, 15 * 60_000, async () =>
        parseTeamStats(
          await sm(`/teams/${t.id}`, {
            include: "statistics.details.type",
            filters: `teamStatisticSeasons:${sid}`,
          }),
        ),
      ),
    ]);
    return {
      teamId: Number(t.id),
      teamName: String(t.name),
      seasonId: sid,
      squad,
      stats,
    } as TeamSeason;
  },

  async leagueXpts() {
    const sid = await seasonId();
    return parseXpts(
      await sm(`/standings/seasons/${sid}`, { include: "participant;details.type" }),
    );
  },
};
