import { describe, expect, it } from "vitest";
import {
  headToHead,
  parseRankings,
  parseScoreboard,
  playerResults,
  recentForm,
  winProbability,
  type Side,
} from "./tennis-model";

const board = {
  events: [
    {
      id: "t1",
      name: "Paris Masters",
      date: "2026-11-01T00:00Z",
      groupings: [
        {
          grouping: { displayName: "Men's Singles" },
          competitions: [
            {
              id: "m1",
              date: "2026-11-02T12:00Z",
              status: { type: { state: "post", shortDetail: "Final" } },
              round: { displayName: "Round of 16" },
              competitors: [
                {
                  order: 1,
                  winner: true,
                  athlete: { id: "1", displayName: "Jannik Sinner", flag: { href: "x.png" } },
                  linescores: [{ value: 6 }, { value: 3 }, { value: 7 }],
                  seed: { displayValue: "2" },
                },
                {
                  order: 2,
                  winner: false,
                  athlete: { id: "2", displayName: "Carlos Alcaraz" },
                  linescores: [{ value: 4 }, { value: 6 }, { value: 5 }],
                },
              ],
            },
            {
              id: "m2",
              date: "2026-11-05T12:00Z",
              status: { type: { state: "post" } },
              competitors: [
                {
                  order: 1,
                  winner: false,
                  athlete: { id: "1", displayName: "Jannik Sinner" },
                  linescores: [{ value: 2 }, { value: 6 }],
                },
                {
                  order: 2,
                  winner: true,
                  athlete: { id: "3", displayName: "Alexander Zverev" },
                  linescores: [{ value: 6 }, { value: 7 }],
                },
              ],
            },
          ],
        },
        {
          grouping: { displayName: "Men's Doubles" },
          competitions: [
            { id: "d1", competitors: [{ athlete: { id: "9" } }, { athlete: { id: "8" } }] },
          ],
        },
      ],
    },
  ],
};

describe("parseScoreboard", () => {
  const ms = parseScoreboard(board, "atp");
  it("lê simples e ignora duplas", () => {
    expect(ms).toHaveLength(2);
    expect(ms[0]).toMatchObject({
      id: "m1",
      tournament: "Paris Masters",
      round: "Round of 16",
      state: "post",
      winner: "a",
      setsA: [6, 3, 7],
      setsB: [4, 6, 5],
    });
    expect(ms[0]!.a).toMatchObject({ name: "Jannik Sinner", seed: 2, flag: "x.png" });
  });
  it("histórico, forma e confronto direto", () => {
    const r = playerResults(ms, "1");
    expect(r.map((x) => x.won)).toEqual([false, true]); // mais recente primeiro
    expect(r[1]).toMatchObject({
      score: "6-4 3-6 7-5",
      gamesFor: 16,
      gamesAgainst: 15,
      setsFor: 2,
      setsAgainst: 1,
    });
    expect(recentForm(r)).toEqual({ n: 2, wins: 1, rate: 0.5 });
    expect(headToHead(ms, "1", "2")).toEqual({ a: 1, b: 0 });
    expect(playerResults(ms, "1", "2026-11-03T00:00Z")).toHaveLength(1);
  });
});

describe("parseRankings", () => {
  it("lê o ranking", () => {
    const r = parseRankings({
      rankings: [
        {
          ranks: [
            {
              current: 1,
              previous: 2,
              points: 11500,
              trend: "+1",
              athlete: { id: 7, displayName: "A" },
            },
            { current: "x", athlete: { id: 8 } },
          ],
        },
      ],
    });
    expect(r).toEqual([
      { id: "7", name: "A", flag: null, rank: 1, previous: 2, points: 11500, trend: "+1" },
    ]);
  });
});

describe("winProbability", () => {
  const side = (points: number | null, formRate: number | null = 0.5, formN = 10): Side => ({
    points,
    rank: null,
    formRate,
    formN,
  });
  it("é simétrica e soma 1", () => {
    const p = winProbability(side(5000), side(3000), { a: 0, b: 0 });
    const q = winProbability(side(3000), side(5000), { a: 0, b: 0 });
    expect(p.a + p.b).toBeCloseTo(1);
    expect(p.a).toBeCloseTo(q.b);
    expect(p.a).toBeGreaterThan(0.5);
  });
  it("jogadores iguais dão 50%", () => {
    expect(winProbability(side(4000), side(4000), { a: 0, b: 0 }).a).toBeCloseTo(0.5);
  });
  it("forma e confronto direto deslocam a probabilidade", () => {
    const base = winProbability(side(4000, 0.5), side(4000, 0.5), { a: 0, b: 0 }).a;
    expect(winProbability(side(4000, 0.9), side(4000, 0.3), { a: 0, b: 0 }).a).toBeGreaterThan(
      base,
    );
    expect(winProbability(side(4000), side(4000), { a: 0, b: 3 }).a).toBeLessThan(base);
  });
  it("limita entre 3% e 97% e reduz confiança sem ranking", () => {
    const p = winProbability(side(12000, 1), side(10, 0), { a: 3, b: 0 });
    expect(p.a).toBeLessThanOrEqual(0.97);
    expect(winProbability(side(null, null, 0), side(4000), { a: 0, b: 0 }).confidence).toBe(
      "baixa",
    );
    expect(winProbability(side(4000), side(4100), { a: 0, b: 0 }).confidence).toBe("alta");
  });
});

import { buildRankMap, matchProbability, rankOf, type RankEntry } from "./tennis-model";

describe("ranking robusto e dados insuficientes", () => {
  const rk = (id: string, name: string, rank: number, points: number): RankEntry => ({
    id,
    name,
    flag: null,
    rank,
    previous: rank,
    points,
    trend: "",
  });
  const ms = parseScoreboard(board, "atp");
  it("casa o jogador por nome quando o id do ranking é diferente", () => {
    const map = buildRankMap([rk("999", "Jannik Sinner", 2, 9000)]);
    expect(rankOf(map, { id: "1", name: "Jannik Sinner" })?.rank).toBe(2);
    expect(rankOf(map, { id: "2", name: "Carlos Alcaraz" })).toBeUndefined();
  });
  it("sem ranking nem forma: dados insuficientes (não 50% enganoso)", () => {
    const pre = { ...ms[0]!, state: "pre" as const, winner: null, date: "2020-01-01T00:00Z" };
    expect(matchProbability(pre, new Map(), [pre]).insufficient).toBe(true);
  });
  it("com ranking, favorece quem tem mais pontos mesmo com id diferente", () => {
    const map = buildRankMap([
      rk("a", "Jannik Sinner", 2, 9000),
      rk("b", "Carlos Alcaraz", 1, 11000),
    ]);
    const pre = { ...ms[0]!, state: "pre" as const, winner: null, date: "2020-01-01T00:00Z" };
    const p = matchProbability(pre, map, [pre]);
    expect(p.insufficient).toBe(false);
    expect(p.a).toBeLessThan(0.5); // Sinner (a) tem menos pontos que Alcaraz (b)
  });
  it("jogador fora do ranking recebe piso (80% do menor valor do top) e perde para um top", () => {
    const map = buildRankMap([
      rk("b", "Carlos Alcaraz", 1, 11000),
      rk("z", "Ultimo do Top", 150, 600),
    ]);
    const pre = { ...ms[0]!, state: "pre" as const, winner: null, date: "2020-01-01T00:00Z" };
    expect(matchProbability(pre, map, [pre]).a).toBeLessThan(0.3);
  });
});

import { surfaceRecord, type PlayerResult } from "./tennis-model";

describe("piso da quadra no modelo", () => {
  const base: Side = { points: 4000, rank: null, formRate: 0.5, formN: 10 };
  it("favorece quem tem melhor retrospecto no piso (mesmo com ranking igual)", () => {
    const p = winProbability(base, base, { a: 0, b: 0 }, 100, {
      surface: "clay",
      a: { wins: 18, games: 20, overall: 0.6 },
      b: { wins: 5, games: 20, overall: 0.6 },
    });
    expect(p.a).toBeGreaterThan(0.6);
    expect(p.factors.map((f) => f.label)).toContain("Piso (saibro)");
  });
  it("poucos jogos no piso pesam pouco (encolhe para a média geral)", () => {
    const few = winProbability(base, base, { a: 0, b: 0 }, 100, {
      surface: "grass",
      a: { wins: 2, games: 2, overall: 0.5 },
      b: { wins: 0, games: 2, overall: 0.5 },
    });
    const many = winProbability(base, base, { a: 0, b: 0 }, 100, {
      surface: "grass",
      a: { wins: 20, games: 20, overall: 0.5 },
      b: { wins: 0, games: 20, overall: 0.5 },
    });
    expect(few.a).toBeLessThan(many.a);
    expect(few.a).toBeGreaterThan(0.5);
  });
  it("sem piso conhecido não há fator de piso", () => {
    expect(winProbability(base, base, { a: 0, b: 0 }).factors).toHaveLength(3);
  });
  it("surfaceRecord filtra por piso", () => {
    const r = (surface: PlayerResult["surface"], won: boolean): PlayerResult => ({
      matchId: "x",
      date: "",
      tournament: "",
      surface,
      round: "",
      opponent: { id: "1", name: "", shortName: "", flag: null, seed: null },
      won,
      score: "",
      gamesFor: 12,
      gamesAgainst: 8,
      setsFor: 2,
      setsAgainst: 0,
      sets: [],
    });
    const rs = [r("clay", true), r("clay", false), r("hard", true), r(null, true)];
    expect(surfaceRecord(rs, "clay")).toMatchObject({ n: 2, w: 1, l: 1, rate: 0.5 });
    expect(surfaceRecord(rs, null).n).toBe(4);
    expect(surfaceRecord(rs, "grass")).toMatchObject({ n: 0, rate: null });
  });
  it("o parser marca piso e categoria pelo nome do torneio", () => {
    const m = parseScoreboard(
      {
        events: [
          {
            id: "1",
            name: "Rolex Paris Masters",
            groupings: [
              {
                grouping: { displayName: "Men's Singles" },
                competitions: [
                  {
                    id: "c",
                    competitors: [
                      { order: 1, athlete: { id: "1", displayName: "A" } },
                      { order: 2, athlete: { id: "2", displayName: "B" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      "atp",
    );
    expect(m[0]).toMatchObject({ surface: "hard", indoor: true, category: "masters" });
  });
});
