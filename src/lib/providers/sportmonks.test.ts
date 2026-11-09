import { describe, expect, it } from "vitest";
import {
  parseMatchXg,
  parsePlayerSeasonXg,
  parseSeasonId,
  parseSquad,
  parseTeamStats,
  parseTopscorers,
  parseXpts,
  statNumber,
} from "./sportmonks";
import { normName, sameTeam } from "./names";

// Fixtures montadas a partir dos exemplos da documentação da Sportmonks (v3).
describe("sportmonks parsers", () => {
  it("lê o id da temporada atual", () => {
    expect(parseSeasonId({ data: { currentseason: { id: 26000 } } })).toBe(26000);
    expect(parseSeasonId({ data: {} })).toBeNull();
  });

  it("lê artilheiros", () => {
    const r = parseTopscorers({
      data: [
        {
          position: 1,
          player_id: 7,
          participant_id: 9,
          total: 12,
          player: { display_name: "G. Cano" },
          participant: { name: "Fluminense" },
        },
      ],
    });
    expect(r[0]).toMatchObject({
      position: 1,
      playerId: 7,
      name: "G. Cano",
      team: "Fluminense",
      value: 12,
    });
  });

  it("lê xG de temporada do jogador", () => {
    const j = {
      data: {
        statistics: [
          {
            details: [
              { type_id: 40, value: { total: 3 } },
              { type_id: 5304, value: { expected: 7.4619, actual: 9 } },
            ],
          },
        ],
      },
    };
    expect(parsePlayerSeasonXg(j)).toBe(7.46);
    expect(parsePlayerSeasonXg({ data: { statistics: [] } })).toBeNull();
  });

  it("lê xPts da classificação", () => {
    const j = {
      data: [
        {
          participant_id: 9,
          participant: { name: "Flamengo" },
          details: [
            { type_id: 179, value: 7 },
            { type_id: 7939, value: 31.256 },
          ],
        },
        { participant_id: 10, details: [] },
      ],
    };
    expect(parseXpts(j)).toEqual([{ teamId: 9, team: "Flamengo", xPts: 31.26 }]);
  });

  it("lê xG do jogo (times e jogadores)", () => {
    const j = {
      data: {
        id: 99,
        participants: [
          { id: 9, meta: { location: "home" } },
          { id: 14, meta: { location: "away" } },
        ],
        expected: [
          { type_id: 5304, participant_id: 9, data: { value: 3.6439 } },
          { type_id: 5304, participant_id: 14, data: { value: 0.3841 } },
          { type_id: 5305, participant_id: 9, data: { value: 4.4602 } },
        ],
        lineups: [
          {
            player_id: 1,
            team_id: 9,
            player_name: "Haaland",
            expected: [
              { type_id: 5304, data: { value: 1.1634 } },
              { type_id: 5305, data: { value: 1.1634 } },
            ],
          },
          { player_id: 2, team_id: 14, player_name: "Sem dado", expected: [] },
        ],
      },
    };
    const m = parseMatchXg(j)!;
    expect(m.homeXg).toBe(3.64);
    expect(m.awayXg).toBe(0.38);
    expect(m.homeXgot).toBe(4.46);
    expect(m.awayXgot).toBeNull();
    expect(m.players).toHaveLength(1);
    expect(m.players[0]).toMatchObject({ name: "Haaland", xg: 1.16 });
    expect(parseMatchXg({})).toBeNull();
  });
});

describe("casamento de nomes de times", () => {
  it("normaliza acentos e ruído", () => {
    expect(normName("Grêmio FC")).toBe("gremio");
  });
  it("casa nomes parecidos entre fontes", () => {
    expect(sameTeam("Vasco da Gama", "Vasco")).toBe(true);
    expect(sameTeam("Atlético-MG", "Atletico Mineiro")).toBe(true);
    expect(sameTeam("Athletico-PR", "Athletico Paranaense")).toBe(true);
    expect(sameTeam("Atlético-MG", "Atlético-GO")).toBe(false);
    expect(sameTeam("Flamengo", "Fluminense")).toBe(false);
  });
});

describe("elenco e estatísticas do time", () => {
  it("statNumber lê formatos diferentes", () => {
    expect(statNumber(5)).toBe(5);
    expect(statNumber({ total: 3 })).toBe(3);
    expect(statNumber({ expected: 7.5, actual: 9 })).toBe(7.5);
    expect(statNumber({ all: { count: 30, average: 1.5 } })).toBe(30);
    expect(statNumber({ foo: 1 })).toBeNull();
    expect(statNumber(null)).toBeNull();
  });

  it("lê o elenco com posição, idade e estatísticas por developer_name", () => {
    const j = {
      data: [
        {
          player_id: 5,
          jersey_number: 9,
          position_id: 27,
          player: { display_name: "Pedro", date_of_birth: "1997-06-20" },
          details: [
            { type_id: 52, value: { total: 11 }, type: { developer_name: "GOALS" } },
            {
              type_id: 5304,
              value: { expected: 8.123, actual: 11 },
              type: { developer_name: "EXPECTED_GOALS" },
            },
            { type_id: 1, value: { foo: 1 }, type: { developer_name: "OUTRO" } },
          ],
        },
        { player_id: 6, position_id: 24, player: { name: "Goleiro" }, details: [] },
      ],
    };
    const sq = parseSquad(j);
    expect(sq).toHaveLength(2);
    expect(sq[0]).toMatchObject({ name: "Pedro", jersey: 9, position: "ATA" });
    expect(sq[0]!.age).toBeGreaterThan(20);
    expect(sq[0]!.stats).toEqual({ GOALS: 11, EXPECTED_GOALS: 8.12 });
    expect(sq[1]).toMatchObject({ position: "GOL", jersey: null, age: null });
  });

  it("lê estatísticas de time (contagem e média por jogo)", () => {
    const j = {
      data: {
        statistics: [
          {
            details: [
              {
                type_id: 52,
                value: { all: { count: 30, average: 1.5 }, home: { count: 18 } },
                type: { developer_name: "GOALS", name: "Goals", stat_group: "offensive" },
              },
              {
                type_id: 5304,
                value: { expected: 25.4 },
                type: {
                  developer_name: "EXPECTED_GOALS",
                  name: "Expected Goals (xG)",
                  stat_group: "offensive",
                },
              },
              { type_id: 9, value: "texto", type: { developer_name: "X", name: "X" } },
            ],
          },
        ],
      },
    };
    const st = parseTeamStats(j);
    expect(st).toHaveLength(2);
    expect(st[0]).toMatchObject({ code: "GOALS", value: 30, average: 1.5, group: "offensive" });
    expect(st[1]).toMatchObject({ code: "EXPECTED_GOALS", value: 25.4, average: null });
    expect(parseTeamStats({})).toEqual([]);
  });
});
