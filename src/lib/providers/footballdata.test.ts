import { describe, expect, it } from "vitest";
import { parseScorers, parseSquad } from "./footballdata";

describe("football-data.org parsers", () => {
  const json = {
    scorers: [
      {
        player: { id: 1, name: "Pedro" },
        team: { id: 9, name: "CR Flamengo", shortName: "Flamengo" },
        goals: 12,
        assists: 3,
      },
      {
        player: { id: 2, name: "Cano" },
        team: { id: 10, name: "Fluminense FC" },
        goals: 9,
        assists: 7,
      },
      {
        player: { id: 3, name: "Sem assist" },
        team: { id: 11, name: "X" },
        goals: 5,
        assists: null,
      },
    ],
  };
  it("ordena artilharia por gols", () => {
    const r = parseScorers(json, "goals");
    expect(r.map((x) => x.name)).toEqual(["Pedro", "Cano", "Sem assist"]);
    expect(r[0]).toMatchObject({ position: 1, team: "Flamengo", value: 12 });
  });
  it("ordena assistências e ignora jogadores sem assistência", () => {
    const r = parseScorers(json, "assists");
    expect(r.map((x) => [x.name, x.value])).toEqual([
      ["Cano", 7],
      ["Pedro", 3],
    ]);
  });
  it("sem assistências na fonte devolve lista vazia", () => {
    expect(
      parseScorers({ scorers: [{ player: { id: 1, name: "A" }, team: {}, goals: 4 }] }, "assists"),
    ).toEqual([]);
  });
  it("lê elenco com posição e idade", () => {
    const sq = parseSquad({
      squad: [
        { id: 5, name: "Goleiro", position: "Goalkeeper", dateOfBirth: "1990-01-01" },
        { id: 6, name: "Atacante", position: "Offence", shirtNumber: 9 },
      ],
    });
    expect(sq[0]).toMatchObject({ position: "GOL", jersey: null });
    expect(sq[0]!.age).toBeGreaterThan(30);
    expect(sq[1]).toMatchObject({ position: "ATA", jersey: 9, age: null });
  });
});
