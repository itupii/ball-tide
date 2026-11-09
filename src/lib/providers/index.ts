import type { Capability, ProviderInfo } from "./types";

/** Registro estático: o que cada fonte entrega hoje e o que está planejado. */
export const PROVIDER_PLAN: {
  id: ProviderInfo["id"];
  label: string;
  capabilities: Capability[];
  status: "ativo" | "planejado";
}[] = [
  {
    id: "espn",
    label: "ESPN",
    status: "ativo",
    capabilities: ["scoreboard", "teamMatchStats", "lineups"],
  },
  {
    id: "sportmonks",
    label: "Sportmonks",
    status: "ativo",
    capabilities: ["playerSeasonStats", "playerXg", "teamXg", "xPts"],
  },
  {
    id: "opta",
    label: "Stats Perform (Opta)",
    status: "planejado",
    capabilities: ["shotCoordinates", "passEvents"],
  },
];

export * from "./types";
