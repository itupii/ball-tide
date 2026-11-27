export type Surface = "hard" | "clay" | "grass";
export type Category = "grand_slam" | "masters" | "500" | "250" | "finals" | "team" | "other";

export interface TournamentInfo {
  surface: Surface | null;
  indoor: boolean;
  category: Category;
}

export const SURFACE_PT: Record<Surface, string> = {
  hard: "Quadra dura",
  clay: "Saibro",
  grass: "Grama",
};
export const CATEGORY_PT: Record<Category, string> = {
  grand_slam: "Grand Slam",
  masters: "Masters/WTA 1000",
  "500": "500",
  "250": "250",
  finals: "Finals",
  team: "Torneio por equipes",
  other: "Outros",
};

type Rule = [RegExp, Surface, Category, { indoor?: boolean; tour?: "atp" | "wta" }?];

/**
 * Tabela curada (nome do torneio -> piso e categoria). A ESPN não informa o piso; torneios que não casarem
 * ficam sem piso (o modelo então não aplica o ajuste de piso). Revise a cada temporada.
 */
const RULES: Rule[] = [
  // Grand Slams
  [/australian open/, "hard", "grand_slam"],
  [/roland garros|french open/, "clay", "grand_slam"],
  [/wimbledon/, "grass", "grand_slam"],
  [/\bus open\b/, "hard", "grand_slam"],
  // finais e eventos especiais
  [/atp finals|nitto atp|next gen/, "hard", "finals", { indoor: true }],
  [/wta finals/, "hard", "finals", { indoor: true }],
  [/united cup/, "hard", "team"],
  [/davis cup|billie jean king|laver cup/, "hard", "team", { indoor: true }],
  // Masters 1000 / WTA 1000
  [/indian wells|bnp paribas open/, "hard", "masters"],
  [/\bmiami\b/, "hard", "masters"],
  [/monte.?carlo/, "clay", "masters"],
  [/\bmadrid\b/, "clay", "masters"],
  [/\brome\b|italian open|internazionali/, "clay", "masters"],
  [/canadian open|national bank open|toronto|montreal/, "hard", "masters"],
  [/cincinnati|western (&|and) southern/, "hard", "masters"],
  [/shanghai/, "hard", "masters", { tour: "atp" }],
  [/paris masters|rolex paris/, "hard", "masters", { indoor: true }],
  [/\bdubai\b/, "hard", "masters", { tour: "wta" }],
  [/\bdoha\b|qatar/, "hard", "masters", { tour: "wta" }],
  [/wuhan|china open|beijing/, "hard", "masters", { tour: "wta" }],
  // 500 / 250: saibro
  [/barcelona/, "clay", "500"],
  [/hamburg/, "clay", "500"],
  [/\brio\b/, "clay", "500"],
  [/buenos aires|argentina open/, "clay", "250"],
  [/santiago|chile open/, "clay", "250"],
  [/cordoba/, "clay", "250"],
  [/estoril|portugal open/, "clay", "250"],
  [/marrakech|rabat|morocco/, "clay", "250"],
  [/houston|charleston|bogota|parma|strasbourg|istanbul|prague/, "clay", "250"],
  [
    /munich|bmw open|geneva|gstaad|swiss open|umag|croatia open|kitzbuhel|bastad|swedish open|bucharest|lausanne|palermo|budapest|warsaw|iasi/,
    "clay",
    "250",
  ],
  [/lyon/, "clay", "250"],
  [/stuttgart/, "grass", "500", { tour: "atp" }],
  [/stuttgart|porsche/, "clay", "500", { indoor: true, tour: "wta" }],
  // grama
  [
    /halle|terra wortmann|queen'?s|cinch|hertogenbosch|libema|mallorca|eastbourne|newport|bad homburg|berlin|birmingham|nottingham|surbiton|ilkley/,
    "grass",
    "250",
  ],
  // quadra dura coberta
  [/rotterdam|abn amro/, "hard", "500", { indoor: true }],
  [/vienna|erste bank|basel|swiss indoors/, "hard", "500", { indoor: true }],
  [
    /montpellier|marseille|antwerp|european open|stockholm|metz|astana|sofia|moselle|linz|ostrava|brussels|belgrade|saint.?petersburg|hong kong|ningbo|seoul|korea open|tel aviv|nur.?sultan/,
    "hard",
    "250",
    { indoor: true },
  ],
  // quadra dura
  [/acapulco|abierto mexicano/, "hard", "500"],
  [
    /washington|citi open|tokyo|japan open|pan pacific|los cabos|atlanta|winston.?salem|delray|dallas|chengdu|zhuhai|brisbane|adelaide|auckland|hobart|sydney|melbourne|cleveland|guadalajara|monterrey|tampa|san diego|san jose|osaka|merida|cabo/,
    "hard",
    "250",
  ],
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function tournamentInfo(name: string, tour?: "atp" | "wta"): TournamentInfo {
  const n = norm(name);
  for (const [re, surface, category, opt] of RULES) {
    if (opt?.tour && tour && opt.tour !== tour) continue;
    if (re.test(n)) return { surface, indoor: !!opt?.indoor, category };
  }
  return { surface: null, indoor: false, category: "other" };
}

/** Taxa de vitórias "encolhida" para a média geral quando há poucos jogos no piso (k = jogos fictícios). */
export function shrunkRate(wins: number, games: number, overall: number | null, k = 6): number {
  const prior = overall ?? 0.5;
  return (wins + k * prior) / (games + k);
}
