import { describe, expect, it } from "vitest";
import { shrunkRate, tournamentInfo } from "./tennis-surface";

describe("tournamentInfo", () => {
  it("Grand Slams", () => {
    expect(tournamentInfo("Roland Garros")).toMatchObject({ surface: "clay", category: "grand_slam" });
    expect(tournamentInfo("Wimbledon")).toMatchObject({ surface: "grass", category: "grand_slam" });
    expect(tournamentInfo("US Open")).toMatchObject({ surface: "hard", category: "grand_slam" });
    expect(tournamentInfo("Australian Open")).toMatchObject({ surface: "hard" });
  });
  it("Masters, coberta e acentos", () => {
    expect(tournamentInfo("Rolex Paris Masters")).toMatchObject({ surface: "hard", indoor: true, category: "masters" });
    expect(tournamentInfo("Mutua Madrid Open")).toMatchObject({ surface: "clay", category: "masters" });
    expect(tournamentInfo("Barcelona Open Banc Sabadell")).toMatchObject({ surface: "clay", category: "500" });
    expect(tournamentInfo("Erste Bank Open (Vienna)")).toMatchObject({ indoor: true, category: "500" });
  });
  it("mesmo torneio em pisos diferentes por circuito (Stuttgart)", () => {
    expect(tournamentInfo("Stuttgart Open", "atp").surface).toBe("grass");
    expect(tournamentInfo("Porsche Tennis Grand Prix Stuttgart", "wta").surface).toBe("clay");
  });
  it("torneio desconhecido fica sem piso", () => {
    expect(tournamentInfo("Torneio Qualquer XYZ")).toEqual({ surface: null, indoor: false, category: "other" });
  });
});

describe("shrunkRate", () => {
  it("poucos jogos puxam para a média geral e muitos jogos pesam mais", () => {
    expect(shrunkRate(2, 2, 0.5)).toBeLessThan(0.7);
    expect(shrunkRate(20, 20, 0.5)).toBeGreaterThan(0.85);
    expect(shrunkRate(0, 0, null)).toBe(0.5);
  });
});
