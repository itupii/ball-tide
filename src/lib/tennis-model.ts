/* eslint-disable @typescript-eslint/no-explicit-any */
export type Tour = "atp" | "wta";

export interface TennisPlayerRef {
  id: string;
  name: string;
  shortName: string;
  flag: string | null;
  seed: number | null;
}

export interface TennisMatch {
  id: string;
  tour: Tour;
  date: string;
  tournament: string;
  tournamentId: string;
  round: string;
  group: string;
  state: "pre" | "in" | "post";
  statusText: string;
  a: TennisPlayerRef;
  b: TennisPlayerRef;
  setsA: number[];
  setsB: number[];
  winner: "a" | "b" | null;
}

export interface RankEntry {
  id: string;
  name: string;
  flag: string | null;
  rank: number;
  previous: number;
  points: number;
  trend: string;
}

export interface AthleteProfile {
  name: string | null;
  age: number | null;
  country: string | null;
  height: string | null;
  hand: string | null;
}

/* ---------------- parsers (puros, testáveis sem rede) ---------------- */

const player = (x: any): TennisPlayerRef => {
  const at = x.athlete ?? {};
  const name = String(at.displayName ?? at.fullName ?? at.shortName ?? "—");
  const seed = Number(x.seed?.displayValue ?? x.seed);
  return {
    id: String(at.id ?? x.id ?? name),
    name,
    shortName: String(at.shortName ?? name),
    flag: at.flag?.href ?? null,
    seed: Number.isFinite(seed) && seed > 0 ? seed : null,
  };
};

export function parseScoreboard(json: any, tour: Tour): TennisMatch[] {
  const out: TennisMatch[] = [];
  for (const ev of (json?.events ?? []) as any[]) {
    const comps: { c: any; group: string }[] = [];
    for (const g of (ev.groupings ?? []) as any[])
      for (const c of (g.competitions ?? []) as any[])
        comps.push({ c, group: String(g.grouping?.displayName ?? "") });
    if (!comps.length)
      for (const c of (ev.competitions ?? []) as any[])
        comps.push({ c, group: String(c.type?.text ?? "") });
    for (const { c, group } of comps) {
      if (/double|dupla/i.test(group)) continue;
      const cs = [...((c.competitors ?? []) as any[])].sort(
        (x, y) => Number(x.order ?? 0) - Number(y.order ?? 0),
      );
      if (cs.length < 2 || !cs[0].athlete || !cs[1].athlete) continue;
      const sets = (x: any) =>
        ((x.linescores ?? []) as any[])
          .map((l) => Number(l.value))
          .filter((v) => Number.isFinite(v));
      const a = player(cs[0]);
      const b = player(cs[1]);
      const state = (c.status?.type?.state ?? "pre") as TennisMatch["state"];
      out.push({
        id: String(c.id ?? `${ev.id}-${a.id}-${b.id}`),
        tour,
        date: String(c.date ?? c.startDate ?? ev.date ?? ""),
        tournament: String(ev.name ?? ev.shortName ?? "Torneio"),
        tournamentId: String(ev.id ?? ""),
        round: String(c.round?.displayName ?? c.round?.name ?? ""),
        group,
        state,
        statusText: String(c.status?.type?.shortDetail ?? c.status?.type?.description ?? ""),
        a,
        b,
        setsA: sets(cs[0]),
        setsB: sets(cs[1]),
        winner: cs[0].winner ? "a" : cs[1].winner ? "b" : null,
      });
    }
  }
  return out;
}

export function parseRankings(json: any): RankEntry[] {
  const ranks: any[] = json?.rankings?.[0]?.ranks ?? json?.ranks ?? [];
  return ranks
    .map((r) => ({
      id: String(r.athlete?.id ?? ""),
      name: String(r.athlete?.displayName ?? r.athlete?.fullName ?? "—"),
      flag: r.athlete?.flag?.href ?? null,
      rank: Number(r.current),
      previous: Number(r.previous ?? r.current),
      points: Number(r.points ?? 0),
      trend: String(r.trend ?? ""),
    }))
    .filter((r) => r.id && Number.isFinite(r.rank));
}

export function parseAthleteProfile(json: any): AthleteProfile {
  const a = json?.athlete ?? json ?? {};
  return {
    name: a.displayName ?? a.fullName ?? null,
    age: typeof a.age === "number" ? a.age : null,
    country: a.citizenship ?? a.birthPlace?.country ?? null,
    height: a.displayHeight ?? null,
    hand: a.hand?.displayValue ?? a.plays?.displayValue ?? null,
  };
}

/** Formatos conhecidos do ESPN common/v3: {names|displayNames, totals} ou {stats:[{displayName, displayValue}]}. */
export function parseAthleteStats(json: any): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const cat of (json?.categories ?? json?.splits?.categories ?? []) as any[]) {
    const names: string[] = cat.displayNames ?? cat.labels ?? cat.names ?? [];
    const vals: any[] = cat.totals ?? cat.values ?? [];
    if (names.length && vals.length)
      names.forEach(
        (n, i) => vals[i] != null && out.push({ label: String(n), value: String(vals[i]) }),
      );
    else
      for (const s of (cat.stats ?? []) as any[])
        if (s.displayName && s.displayValue != null)
          out.push({ label: String(s.displayName), value: String(s.displayValue) });
  }
  return out.slice(0, 24);
}

/* ---------------- histórico, forma e confronto direto ---------------- */

export interface PlayerResult {
  matchId: string;
  date: string;
  tournament: string;
  round: string;
  opponent: TennisPlayerRef;
  won: boolean;
  score: string;
  gamesFor: number;
  gamesAgainst: number;
  setsFor: number;
  setsAgainst: number;
}

const scoreText = (mine: number[], theirs: number[]) =>
  mine.map((g, i) => `${g}-${theirs[i] ?? 0}`).join(" ");
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const setsWon = (mine: number[], theirs: number[]) =>
  mine.filter((g, i) => g > (theirs[i] ?? 0)).length;

/** Resultados já encerrados de um jogador, do mais recente para o mais antigo. `before` limita a jogos anteriores a uma data. */
export function playerResults(matches: TennisMatch[], id: string, before?: string): PlayerResult[] {
  const res: PlayerResult[] = [];
  for (const m of matches) {
    if (m.state !== "post" || !m.winner) continue;
    if (before && !(Date.parse(m.date) < Date.parse(before))) continue;
    const isA = m.a.id === id;
    if (!isA && m.b.id !== id) continue;
    const mine = isA ? m.setsA : m.setsB;
    const theirs = isA ? m.setsB : m.setsA;
    res.push({
      matchId: m.id,
      date: m.date,
      tournament: m.tournament,
      round: m.round,
      opponent: isA ? m.b : m.a,
      won: (m.winner === "a") === isA,
      score: scoreText(mine, theirs),
      gamesFor: sum(mine),
      gamesAgainst: sum(theirs),
      setsFor: setsWon(mine, theirs),
      setsAgainst: setsWon(theirs, mine),
    });
  }
  return res.sort((x, y) => Date.parse(y.date) - Date.parse(x.date));
}

export function recentForm(results: PlayerResult[], n = 10) {
  const last = results.slice(0, n);
  const wins = last.filter((r) => r.won).length;
  return { n: last.length, wins, rate: last.length ? wins / last.length : null };
}

export function headToHead(matches: TennisMatch[], a: string, b: string) {
  let aw = 0;
  let bw = 0;
  for (const r of playerResults(matches, a)) {
    if (r.opponent.id !== b) continue;
    if (r.won) aw++;
    else bw++;
  }
  return { a: aw, b: bw };
}

/* ---------------- probabilidade de vitória ---------------- */

export interface Side {
  points: number | null;
  rank: number | null;
  formRate: number | null;
  formN: number;
}
export interface Prob {
  a: number;
  b: number;
  confidence: "alta" | "média" | "baixa";
  /** efeito de cada fator em pontos percentuais a favor do jogador A (negativo favorece B) */
  factors: { label: string; pp: number }[];
}

const K = 0.85; // sensibilidade à razão de pontos de ranking (ln)
const FORM_W = 0.9; // peso da diferença de aproveitamento recente
const H2H_W = 0.15; // peso por vitória de vantagem no confronto direto (limitado a ±3)
const sig = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Estimativa estatística pré-jogo (heurística, não calibrada com backtest):
 * logit = K·ln(pontosA/pontosB) + peso·(formaA − formaB) + peso·(H2H A − H2H B).
 * Sem ranking, usa `floorPoints` (jogador fora do top ranking) e reduz a confiança.
 */
export function winProbability(
  a: Side,
  b: Side,
  h2h: { a: number; b: number },
  floorPoints = 100,
): Prob {
  const pa = Math.max(a.points ?? floorPoints, 1);
  const pb = Math.max(b.points ?? floorPoints, 1);
  const fa = a.formN >= 3 && a.formRate != null ? a.formRate : 0.5;
  const fb = b.formN >= 3 && b.formRate != null ? b.formRate : 0.5;
  const z0 = K * (Math.log(pa) - Math.log(pb));
  const z1 = z0 + FORM_W * (fa - fb);
  const z2 = z1 + H2H_W * clamp(h2h.a - h2h.b, -3, 3);
  const p = clamp(sig(z2), 0.03, 0.97);
  const pp = (x: number) => +(x * 100).toFixed(1);
  const ranked = a.points != null && b.points != null;
  const enough = a.formN >= 5 && b.formN >= 5;
  return {
    a: p,
    b: 1 - p,
    confidence:
      ranked && enough ? "alta" : ranked && a.formN >= 3 && b.formN >= 3 ? "média" : "baixa",
    factors: [
      { label: "Ranking (pontos)", pp: pp(sig(z0) - 0.5) },
      { label: "Forma recente", pp: pp(sig(z1) - sig(z0)) },
      { label: "Confronto direto", pp: pp(sig(z2) - sig(z1)) },
    ],
  };
}

export function matchProbability(
  m: TennisMatch,
  rankById: Map<string, RankEntry>,
  all: TennisMatch[],
): Prob {
  const side = (id: string): Side => {
    const f = recentForm(playerResults(all, id, m.date), 10);
    const r = rankById.get(id);
    return { points: r?.points ?? null, rank: r?.rank ?? null, formRate: f.rate, formN: f.n };
  };
  const floor = Math.max(Math.min(...[...rankById.values()].map((r) => r.points), 100) * 0.8, 1);
  return winProbability(
    side(m.a.id),
    side(m.b.id),
    headToHead(
      all.filter((x) => Date.parse(x.date) < Date.parse(m.date)),
      m.a.id,
      m.b.id,
    ),
    floor,
  );
}
