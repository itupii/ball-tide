import { describe, expect, it } from "vitest";
import { binActivity, classify, parseActivity, parseMinute, totals } from "./activity";

const home = { id: "10", name: "Flamengo" };
const away = { id: "20", name: "Palmeiras" };

describe("classify / parseMinute", () => {
  it("classifica tipos de lance", () => {
    expect(classify("Goal").kind).toBe("goal");
    expect(classify("Penalty - Scored").kind).toBe("goal");
    expect(classify("Shot On Target")).toMatchObject({ kind: "shot", weight: 3, onTarget: true });
    expect(classify("Shot Off Target")).toMatchObject({ kind: "shot", weight: 2, onTarget: false });
    expect(classify("Corner Kick").kind).toBe("corner");
    expect(classify("Foul").kind).toBe("foul");
    expect(classify("Yellow Card").kind).toBe("card");
    expect(classify("Goal Kick").kind).toBe("other");
    expect(classify("Substitution").kind).toBe("sub");
  });
  it("lê minutos do relógio e do texto", () => {
    expect(parseMinute(2700)).toBe(45);
    expect(parseMinute(undefined, "45'+2'")).toBe(47);
    expect(parseMinute(undefined, "12'")).toBe(12);
    expect(parseMinute(undefined, "")).toBeNull();
  });
});

const summary = {
  commentary: [
    {
      time: { value: 120, displayValue: "2'" },
      play: {
        type: { text: "Shot On Target" },
        team: { id: "10" },
        participants: [{ athlete: { displayName: "Pedro" } }],
      },
    },
    {
      time: { displayValue: "3'" },
      text: "Foul by X (Palmeiras).",
      play: { type: { text: "Foul" }, team: { displayName: "Palmeiras" } },
    },
    { time: { value: 3000 }, play: { type: { text: "Goal" }, team: { id: "20" } } },
    { time: { value: 3100 }, play: { type: { text: "Substitution" }, team: { id: "20" } } },
    { time: { value: 3200 }, play: { type: { text: "Goal Kick" }, team: { id: "20" } } },
  ],
};

describe("parseActivity", () => {
  const a = parseActivity(summary, home, away);
  it("lê o lance a lance, descarta substituição e lances neutros", () => {
    expect(a.source).toBe("commentary");
    expect(a.events.map((e) => [e.minute, e.side, e.kind])).toEqual([
      [2, "home", "shot"],
      [3, "away", "foul"],
      [50, "away", "goal"],
    ]);
    expect(a.events[0]!.player).toBe("Pedro");
  });
  it("cai para lances-chave quando não há comentário", () => {
    const k = parseActivity(
      {
        keyEvents: [
          { scoringPlay: true, type: { text: "Goal" }, clock: { value: 600 }, team: { id: "10" } },
          { type: { text: "Yellow Card" }, clock: { displayValue: "30'" }, team: { id: "20" } },
        ],
      },
      home,
      away,
    );
    expect(k.source).toBe("key");
    expect(k.events.map((e) => e.kind)).toEqual(["goal", "card"]);
    expect(parseActivity({}, home, away)).toEqual({ events: [], source: "none" });
  });
  it("agrupa em faixas de 5 minutos com pesos e por tipo", () => {
    const all = binActivity(a.events, "all");
    expect(all).toHaveLength(19); // 0..90 em faixas de 5 min
    expect(all[0]).toMatchObject({ home: 3, away: 0.5 });
    expect(all[10]!.away).toBe(5);
    expect(binActivity(a.events, "shots")[10]!.away).toBe(1);
    expect(binActivity(a.events, "fouls")[0]!.away).toBe(1);
  });
  it("estende as faixas na prorrogação", () => {
    const long = binActivity(
      [
        {
          minute: 108,
          side: "home",
          kind: "shot",
          weight: 2,
          label: "",
          player: null,
          onTarget: false,
        },
      ],
      "all",
    );
    expect(long.length).toBeGreaterThan(21);
    expect(long.at(-1)!.home).toBe(2);
  });
  it("soma totais por time", () => {
    const t = totals(a.events);
    expect(t.home).toMatchObject({ shots: 1, onTarget: 1, goals: 0 });
    expect(t.away).toMatchObject({ fouls: 1, goals: 1, shots: 1 });
  });
});
