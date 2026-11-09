import type { PitchEvent } from "@/lib/espn.functions";

/** O que cada provedor consegue entregar. A UI consulta isto para mostrar/esconder recursos. */
export type Capability =
  | "scoreboard"
  | "teamMatchStats"
  | "lineups"
  | "playerSeasonStats"
  | "teamSeasonStats"
  | "squad"
  | "playerXg"
  | "teamXg"
  | "xPts"
  | "shotCoordinates"
  | "passEvents";

export interface ProviderInfo {
  id: "espn" | "sportmonks" | "opta";
  label: string;
  capabilities: Capability[];
  /** true quando as credenciais necessárias estão configuradas no servidor */
  configured: boolean;
}

export interface PlayerRank {
  position: number;
  playerId: number;
  name: string;
  teamId: number | null;
  team: string;
  value: number;
  /** xG acumulado na temporada (quando o add-on xG estiver ativo) */
  xg?: number | null;
}

export interface SquadPlayer {
  playerId: number;
  name: string;
  jersey: number | null;
  position: "GOL" | "DEF" | "MEI" | "ATA" | "—";
  age: number | null;
  /** Estatísticas da temporada, indexadas pelo `developer_name` da Sportmonks (ex.: GOALS, ASSISTS, MINUTES_PLAYED) */
  stats: Record<string, number>;
}

export interface TeamSeasonStat {
  code: string;
  name: string;
  group: string | null;
  value: number | null;
  /** média por jogo, quando a fonte informa */
  average: number | null;
}

export interface TeamSeason {
  teamId: number;
  teamName: string;
  seasonId: number;
  squad: SquadPlayer[];
  stats: TeamSeasonStat[];
}

export interface MatchXg {
  fixtureId: number;
  homeXg: number | null;
  awayXg: number | null;
  homeXgot: number | null;
  awayXgot: number | null;
  players: {
    playerId: number;
    name: string;
    teamId: number;
    xg: number | null;
    xgot: number | null;
  }[];
}

export interface TeamXpts {
  teamId: number;
  team: string;
  xPts: number;
}

/**
 * Contrato para trocar de provedor sem mexer nas telas.
 * Cada método é opcional: o provedor só implementa o que entrega (veja `capabilities`).
 */
export interface StatsProvider {
  info(): ProviderInfo;
  topPlayers?(metric: "goals" | "assists"): Promise<PlayerRank[]>;
  matchXg?(q: { date: string; home: string; away: string }): Promise<MatchXg | null>;
  leagueXpts?(): Promise<TeamXpts[]>;
  teamSeason?(teamName: string): Promise<TeamSeason | null>;
}

/** Contrato para quando houver provedor de eventos (Opta, Wyscout, SportRadar). */
export interface EventProvider {
  info(): ProviderInfo;
  matchEvents(q: { date: string; home: string; away: string }): Promise<PitchEvent[]>;
}
