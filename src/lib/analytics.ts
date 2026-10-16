import type { PastGame } from "./espn.functions";

export function poissonPmf(k: number, lambda: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
}

export interface TeamProfile {
  games: number;
  gfAvg: number;
  gaAvg: number;
  winPct: number;
  drawPct: number;
  lossPct: number;
  over15: number;
  over25: number;
  over35: number;
  btts: number;
  cleanSheet: number;
  failedToScore: number;
  form: ("W" | "D" | "L")[];
  streak: string;
  points: number;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function profile(games: PastGame[], filter?: "home" | "away"): TeamProfile {
  const g = filter ? games.filter((x) => x.homeAway === filter) : games;
  const n = g.length;
  const sum = (f: (x: PastGame) => number) => g.reduce((a, x) => a + f(x), 0);
  const total = (x: PastGame) => x.goalsFor + x.goalsAgainst;
  let streak = "";
  if (g.length) {
    const r = g[0]!.result;
    let c = 0;
    for (const x of g) {
      if (x.result === r) c++;
      else break;
    }
    streak = `${c} ${r === "W" ? "vitória(s)" : r === "D" ? "empate(s)" : "derrota(s)"} seguida(s)`;
  }
  return {
    games: n,
    gfAvg: n ? +(sum((x) => x.goalsFor) / n).toFixed(2) : 0,
    gaAvg: n ? +(sum((x) => x.goalsAgainst) / n).toFixed(2) : 0,
    winPct: pct(g.filter((x) => x.result === "W").length, n),
    drawPct: pct(g.filter((x) => x.result === "D").length, n),
    lossPct: pct(g.filter((x) => x.result === "L").length, n),
    over15: pct(g.filter((x) => total(x) > 1.5).length, n),
    over25: pct(g.filter((x) => total(x) > 2.5).length, n),
    over35: pct(g.filter((x) => total(x) > 3.5).length, n),
    btts: pct(g.filter((x) => x.goalsFor > 0 && x.goalsAgainst > 0).length, n),
    cleanSheet: pct(g.filter((x) => x.goalsAgainst === 0).length, n),
    failedToScore: pct(g.filter((x) => x.goalsFor === 0).length, n),
    form: g.slice(0, 5).map((x) => x.result),
    streak,
    points: g.reduce((a, x) => a + (x.result === "W" ? 3 : x.result === "D" ? 1 : 0), 0),
  };
}

export interface Probabilities {
  lambdaHome: number;
  lambdaAway: number;
  home: number;
  draw: number;
  away: number;
  over: Record<string, number>;
  btts: number;
  homeCleanSheet: number;
  awayCleanSheet: number;
  scores: { score: string; p: number }[];
  doubleChance: { "1X": number; "12": number; X2: number };
}

/** Poisson model combining attack of one side with the defence of the other. */
export function predict(home: TeamProfile, away: TeamProfile, homeAdv = 1.1): Probabilities {
  const base = 1.35;
  // shrink small samples toward the league average so 5-game form doesn't dominate
  const shrink = (v: number, n: number) => (v * n + base * 6) / (n + 6);
  const hA = shrink(home.gfAvg, home.games), hD = shrink(home.gaAvg, home.games);
  const aA = shrink(away.gfAvg, away.games), aD = shrink(away.gaAvg, away.games);
  const lh = Math.max(0.2, (hA * aD) / base) * homeAdv;
  const la = Math.max(0.2, (aA * hD) / base) / homeAdv;
  const N = 8;
  let ph = 0, pd = 0, pa = 0, btts = 0;
  const over: Record<string, number> = { "0.5": 0, "1.5": 0, "2.5": 0, "3.5": 0, "4.5": 0 };
  const scores: { score: string; p: number }[] = [];
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const p = poissonPmf(i, lh) * poissonPmf(j, la);
      if (i > j) ph += p;
      else if (i === j) pd += p;
      else pa += p;
      if (i > 0 && j > 0) btts += p;
      for (const k of Object.keys(over)) if (i + j > parseFloat(k)) over[k] = (over[k] ?? 0) + p;
      scores.push({ score: `${i}-${j}`, p });
    }
  scores.sort((a, b) => b.p - a.p);
  const r = (x: number) => Math.round(x * 1000) / 10;
  return {
    lambdaHome: +lh.toFixed(2),
    lambdaAway: +la.toFixed(2),
    home: r(ph),
    draw: r(pd),
    away: r(pa),
    over: Object.fromEntries(Object.entries(over).map(([k, v]) => [k, r(v)])),
    btts: r(btts),
    homeCleanSheet: r(poissonPmf(0, la)),
    awayCleanSheet: r(poissonPmf(0, lh)),
    scores: scores.slice(0, 8).map((s) => ({ score: s.score, p: r(s.p) })),
    doubleChance: { "1X": r(ph + pd), "12": r(ph + pa), X2: r(pd + pa) },
  };
}

export const fairOdds = (pctValue: number) => (pctValue > 0 ? +(100 / pctValue).toFixed(2) : 0);

/** Value = model probability × bookmaker odds − 1. Positive means a possible edge. */
export const edge = (pctValue: number, odds: number) => +((pctValue / 100) * odds - 1).toFixed(3);

export interface DisciplineStats {
  sample: number;
  cornersAvg: number;
  cornersAgainstAvg: number;
  cornersTotalAvg: number;
  foulsAvg: number;
  yellowsAvg: number;
  redsAvg: number;
  cardsAvg: number;
  shotsAvg: number;
  shotsOnTargetAvg: number;
  possessionAvg: number;
  offsidesAvg: number;
  savesAvg: number;
  over85Corners: number;
  over45CornersFor: number;
  over25Cards: number;
}

/** Averages of corners/fouls/cards/etc. over games that have those stats. */
export function disciplineStats(games: PastGame[], filter?: "home" | "away"): DisciplineStats {
  const g = (filter ? games.filter((x) => x.homeAway === filter) : games).filter((x) => x.corners != null);
  const n = g.length;
  const avg = (f: (x: PastGame) => number | undefined) => (n ? +(g.reduce((a, x) => a + (f(x) ?? 0), 0) / n).toFixed(2) : 0);
  return {
    sample: n,
    cornersAvg: avg((x) => x.corners),
    cornersAgainstAvg: avg((x) => x.cornersAgainst),
    cornersTotalAvg: avg((x) => (x.corners ?? 0) + (x.cornersAgainst ?? 0)),
    foulsAvg: avg((x) => x.fouls),
    yellowsAvg: avg((x) => x.yellows),
    redsAvg: avg((x) => x.reds),
    cardsAvg: avg((x) => (x.yellows ?? 0) + (x.reds ?? 0)),
    shotsAvg: avg((x) => x.shots),
    shotsOnTargetAvg: avg((x) => x.shotsOnTarget),
    possessionAvg: avg((x) => x.possession),
    offsidesAvg: avg((x) => x.offsides),
    savesAvg: avg((x) => x.saves),
    over85Corners: pct(g.filter((x) => (x.corners ?? 0) + (x.cornersAgainst ?? 0) > 8.5).length, n),
    over45CornersFor: pct(g.filter((x) => (x.corners ?? 0) > 4.5).length, n),
    over25Cards: pct(g.filter((x) => (x.yellows ?? 0) + (x.reds ?? 0) > 2.5).length, n),
  };
}

export interface Pattern {
  label: string;
  hits: number;
  total: number;
  pct: number;
  strength: "forte" | "médio" | "fraco";
}

export function findPatterns(games: PastGame[]): Pattern[] {
  const tests: [string, (g: PastGame) => boolean][] = [
    ["Mais de 1.5 gols no jogo", (g) => g.goalsFor + g.goalsAgainst > 1.5],
    ["Mais de 2.5 gols no jogo", (g) => g.goalsFor + g.goalsAgainst > 2.5],
    ["Menos de 2.5 gols no jogo", (g) => g.goalsFor + g.goalsAgainst < 2.5],
    ["Ambas marcam", (g) => g.goalsFor > 0 && g.goalsAgainst > 0],
    ["Time marca", (g) => g.goalsFor > 0],
    ["Time marca 2+", (g) => g.goalsFor >= 2],
    ["Não sofre gol", (g) => g.goalsAgainst === 0],
    ["Sofre gol", (g) => g.goalsAgainst > 0],
    ["Não perde", (g) => g.result !== "L"],
    ["Vence", (g) => g.result === "W"],
    ["Vence em casa", (g) => g.homeAway === "home" && g.result === "W"],
    ["Não perde fora", (g) => g.homeAway === "away" && g.result !== "L"],
  ];
  if (games.some((g) => g.corners != null)) {
    tests.push(
      ["Mais de 8.5 escanteios no jogo", (g) => (g.corners ?? 0) + (g.cornersAgainst ?? 0) > 8.5],
      ["Time ganha 5+ escanteios", (g) => (g.corners ?? 0) >= 5],
      ["Time sofre 5+ escanteios", (g) => (g.cornersAgainst ?? 0) >= 5],
      ["Mais de 2.5 cartões no jogo", (g) => (g.yellows ?? 0) + (g.reds ?? 0) > 2.5],
      ["Time comete 10+ faltas", (g) => (g.fouls ?? 0) >= 10],
      ["Time finaliza 10+ vezes", (g) => (g.shots ?? 0) >= 10],
    );
  }
  const windows = [5, 10, games.length];
  const out: Pattern[] = [];
  for (const [label, fn] of tests) {
    for (const w of windows) {
      let sample = games.slice(0, w);
      if (label.includes("em casa")) sample = games.filter((g) => g.homeAway === "home").slice(0, w);
      if (label.includes("fora")) sample = games.filter((g) => g.homeAway === "away").slice(0, w);
      if (sample.length < 4) continue;
      const hits = sample.filter(fn).length;
      const p = Math.round((hits / sample.length) * 100);
      if (p >= 70) {
        out.push({
          label: `${label} — últimos ${sample.length}`,
          hits,
          total: sample.length,
          pct: p,
          strength: p >= 85 ? "forte" : p >= 75 ? "médio" : "fraco",
        });
        break;
      }
    }
  }
  return out.sort((a, b) => b.pct - a.pct || b.total - a.total);
}
