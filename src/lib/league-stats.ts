import type { LeagueRow } from "./league.functions";

export interface TeamRank extends LeagueRow {
  ppg: number;
  aproveitamento: number;
  gfPg: number;
  gaPg: number;
  sg: number;
  sgPg: number;
  /** Pontos esperados pela expectativa pitagórica (proxy de xPts, sem dados de chute) */
  xPts: number;
  /** Pontos reais − esperados */
  luck: number;
}

const r2 = (n: number) => +n.toFixed(2);

export function teamRanks(rows: LeagueRow[]): TeamRank[] {
  // Expectativa pitagórica (expoente 1,7) por time; os pontos totais da liga são
  // redistribuídos proporcionalmente, então a soma de xPts = soma de pontos reais.
  const k = 1.7;
  const share = (t: LeagueRow) =>
    t.gf + t.ga > 0 ? Math.pow(t.gf, k) / (Math.pow(t.gf, k) + Math.pow(t.ga, k)) : 0.5;
  const weight = rows.reduce((a, t) => a + share(t) * t.played, 0);
  const totalPts = rows.reduce((a, t) => a + t.points, 0);
  const scale = weight > 0 ? totalPts / weight : 0;
  return rows.map((t) => {
    const j = Math.max(t.played, 1);
    const xPts = share(t) * t.played * scale;
    return {
      ...t,
      ppg: r2(t.points / j),
      aproveitamento: r2((t.points / (3 * j)) * 100),
      gfPg: r2(t.gf / j),
      gaPg: r2(t.ga / j),
      sg: t.gf - t.ga,
      sgPg: r2((t.gf - t.ga) / j),
      xPts: r2(xPts),
      luck: r2(t.points - xPts),
    };
  });
}

export function leagueSummary(rows: LeagueRow[]) {
  const games = rows.reduce((a, t) => a + t.played, 0) / 2;
  const goals = rows.reduce((a, t) => a + t.gf, 0);
  const draws = rows.reduce((a, t) => a + t.draws, 0) / 2;
  return {
    games: Math.round(games),
    goals,
    goalsPerGame: games ? r2(goals / games) : 0,
    drawPct: games ? Math.round((draws / games) * 100) : 0,
  };
}
