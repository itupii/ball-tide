/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlayerRank, ProviderInfo, SquadPlayer, StatsProvider, TeamSeason } from "./types";
import { cached } from "./cache";
import { sameTeam } from "./names";

/** football-data.org v4, plano GRÁTIS: inclui a Série A (BSA), 10 req/min, sem xG nem estatísticas detalhadas. */
const BASE = "https://api.football-data.org/v4";
const COMP = "BSA";

export const footballDataConfigured = () => !!process.env["FOOTBALL_DATA_API_KEY"];

async function fd(path: string): Promise<any> {
  const key = process.env["FOOTBALL_DATA_API_KEY"];
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY não configurado");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Auth-Token": key, accept: "application/json" },
  });
  if (res.status === 429)
    throw new Error("Limite do plano grátis atingido (10 req/min). Tente novamente em instantes.");
  if (!res.ok) throw new Error(`football-data.org ${res.status} em ${path}`);
  return res.json();
}

/* ---------- parsers puros ---------- */

export function parseScorers(json: any, metric: "goals" | "assists"): PlayerRank[] {
  const rows = ((json?.scorers ?? []) as any[]).map((r) => ({
    playerId: Number(r.player?.id),
    name: String(r.player?.name ?? "—"),
    teamId: r.team?.id ? Number(r.team.id) : null,
    team: String(r.team?.shortName ?? r.team?.name ?? "—"),
    value: Number((metric === "goals" ? r.goals : r.assists) ?? 0),
  }));
  // Assistências só existem quando a fonte envia; sem nenhuma, devolve lista vazia
  if (
    metric === "assists" &&
    !((json?.scorers ?? []) as any[]).some((r) => typeof r.assists === "number")
  )
    return [];
  return rows
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({ ...r, position: i + 1 }));
}

const POS: Record<string, SquadPlayer["position"]> = {
  Goalkeeper: "GOL",
  Defence: "DEF",
  Defender: "DEF",
  "Centre-Back": "DEF",
  "Left-Back": "DEF",
  "Right-Back": "DEF",
  Midfield: "MEI",
  Midfielder: "MEI",
  Offence: "ATA",
  Attacker: "ATA",
  Forward: "ATA",
};

export function parseSquad(json: any): SquadPlayer[] {
  const now = Date.now();
  return ((json?.squad ?? []) as any[]).map((p) => {
    const dob = p.dateOfBirth ? Date.parse(p.dateOfBirth) : NaN;
    return {
      playerId: Number(p.id),
      name: String(p.name ?? "—"),
      jersey: p.shirtNumber != null ? Number(p.shirtNumber) : null,
      position: POS[String(p.position)] ?? "—",
      age: Number.isFinite(dob) ? Math.floor((now - dob) / (365.25 * 24 * 3600 * 1000)) : null,
      stats: {},
    } as SquadPlayer;
  });
}

/* ---------- provedor ---------- */

export const footballData: StatsProvider = {
  info(): ProviderInfo {
    return {
      id: "footballdata",
      label: "football-data.org",
      configured: footballDataConfigured(),
      capabilities: ["playerSeasonStats", "squad"],
    };
  },

  async topPlayers(metric) {
    const json = await cached(`fd:scorers`, 15 * 60_000, () =>
      fd(`/competitions/${COMP}/scorers?limit=50`),
    );
    return parseScorers(json, metric).slice(0, 25);
  },

  async teamSeason(teamName): Promise<TeamSeason | null> {
    const list = await cached(
      `fd:teams`,
      6 * 3600_000,
      async () => ((await fd(`/competitions/${COMP}/teams`)).teams ?? []) as any[],
    );
    const t = list.find(
      (x) => sameTeam(String(x.name), teamName) || sameTeam(String(x.shortName ?? ""), teamName),
    );
    if (!t) return null;
    const detail = await cached(`fd:team:${t.id}`, 30 * 60_000, () => fd(`/teams/${t.id}`));
    return {
      teamId: Number(t.id),
      teamName: String(t.name),
      seasonId: 0,
      squad: parseSquad(detail),
      stats: [],
    };
  },
};
