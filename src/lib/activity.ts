/* eslint-disable @typescript-eslint/no-explicit-any */
export type ActivityKind =
  "goal" | "shot" | "corner" | "foul" | "card" | "offside" | "sub" | "other";

export interface ActivityEvent {
  minute: number;
  side: "home" | "away" | null;
  kind: ActivityKind;
  /** peso na "intensidade" do jogo: gol 5, chute no alvo 3, chute 2, escanteio 1.5, cartão 1, falta/impedimento 0.5 */
  weight: number;
  label: string;
  player: string | null;
  onTarget: boolean;
}

export interface Activity {
  events: ActivityEvent[];
  /** commentary = lance a lance completo; key = só lances-chave (gols, cartões, substituições) */
  source: "commentary" | "key" | "none";
}

export interface SideRef {
  id: string;
  name: string;
}

export function classify(typeText: string): {
  kind: ActivityKind;
  weight: number;
  onTarget: boolean;
} {
  const t = typeText.toLowerCase();
  if (/own goal|goal/.test(t) && !/no goal|disallowed|kick|goal kick|goalkeeper/.test(t))
    return { kind: "goal", weight: 5, onTarget: true };
  if (/penalty.*scored|scored/.test(t)) return { kind: "goal", weight: 5, onTarget: true };
  if (/shot|save|saved|attempt|header|post|bar/.test(t) && !/foul|clearance/.test(t)) {
    const onTarget = /on target|saved|save/.test(t);
    return { kind: "shot", weight: onTarget ? 3 : 2, onTarget };
  }
  if (/corner/.test(t)) return { kind: "corner", weight: 1.5, onTarget: false };
  if (/card/.test(t)) return { kind: "card", weight: 1, onTarget: false };
  if (/foul|handball/.test(t)) return { kind: "foul", weight: 0.5, onTarget: false };
  if (/offside/.test(t)) return { kind: "offside", weight: 0.5, onTarget: false };
  if (/substitution/.test(t)) return { kind: "sub", weight: 0, onTarget: false };
  return { kind: "other", weight: 0, onTarget: false };
}

/** "45'+2'" -> 47; usa segundos quando a fonte envia o relógio numérico. */
export function parseMinute(clock: any, display?: string): number | null {
  const v = Number(clock);
  if (Number.isFinite(v) && v > 0) return Math.floor(v / 60);
  const m = String(display ?? "").match(/(\d+)(?:'|’)?\s*(?:\+\s*(\d+))?/);
  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function sideOf(play: any, text: string, home: SideRef, away: SideRef): ActivityEvent["side"] {
  const id = play?.team?.id != null ? String(play.team.id) : null;
  if (id === home.id) return "home";
  if (id === away.id) return "away";
  const name = norm(String(play?.team?.displayName ?? ""));
  if (name && (norm(home.name).includes(name) || name.includes(norm(home.name)))) return "home";
  if (name && (norm(away.name).includes(name) || name.includes(norm(away.name)))) return "away";
  const t = norm(text);
  const h = t.includes(`(${norm(home.name)}`) || t.includes(norm(home.name));
  const a = t.includes(`(${norm(away.name)}`) || t.includes(norm(away.name));
  if (h && !a) return "home";
  if (a && !h) return "away";
  return null;
}

export function parseActivity(s: any, home: SideRef, away: SideRef): Activity {
  const events: ActivityEvent[] = [];
  const commentary: any[] = s?.commentary ?? [];
  for (const c of commentary) {
    const p = c.play ?? c;
    const type = String(p.type?.text ?? "");
    const text = String(c.text ?? p.text ?? "");
    const minute = parseMinute(
      c.time?.value ?? p.clock?.value,
      c.time?.displayValue ?? p.clock?.displayValue,
    );
    if (minute == null || !type) continue;
    const k = classify(type);
    if (k.kind === "other" || k.kind === "sub") continue;
    events.push({
      minute,
      side: sideOf(p, text, home, away),
      kind: k.kind,
      weight: k.weight,
      label: type,
      player: p.participants?.[0]?.athlete?.displayName ?? null,
      onTarget: k.onTarget,
    });
  }
  if (events.length) return { events, source: "commentary" };

  for (const k of (s?.keyEvents ?? []) as any[]) {
    const type = String(k.type?.text ?? "");
    const minute = parseMinute(k.clock?.value, k.clock?.displayValue);
    if (minute == null || !type) continue;
    const c = classify(k.scoringPlay ? "Goal" : type);
    if (c.kind === "other" || c.kind === "sub") continue;
    events.push({
      minute,
      side: sideOf(k, String(k.text ?? ""), home, away),
      kind: c.kind,
      weight: c.weight,
      label: type,
      player: k.participants?.[0]?.athlete?.displayName ?? null,
      onTarget: c.onTarget,
    });
  }
  return { events, source: events.length ? "key" : "none" };
}

/* ---------------- agrupamento em faixas de minutos ---------------- */

export type Metric = "all" | "shots" | "corners" | "fouls";

const MATCH: Record<Metric, (e: ActivityEvent) => boolean> = {
  all: () => true,
  shots: (e) => e.kind === "shot" || e.kind === "goal",
  corners: (e) => e.kind === "corner",
  fouls: (e) => e.kind === "foul" || e.kind === "card",
};

export interface Bin {
  start: number;
  end: number;
  home: number;
  away: number;
  /** soma bruta de pontos de intensidade (peso) de cada lado */
  homeEvents: ActivityEvent[];
  awayEvents: ActivityEvent[];
}

export function binActivity(events: ActivityEvent[], metric: Metric = "all", size = 5): Bin[] {
  const maxMin = Math.max(90, ...events.map((e) => e.minute));
  const n = Math.ceil((maxMin + 1) / size);
  const bins: Bin[] = Array.from({ length: n }, (_, i) => ({
    start: i * size,
    end: i * size + size,
    home: 0,
    away: 0,
    homeEvents: [],
    awayEvents: [],
  }));
  for (const e of events.filter(MATCH[metric])) {
    if (!e.side) continue;
    const b = bins[Math.min(Math.floor(e.minute / size), n - 1)]!;
    // métricas específicas contam ocorrências (1 cada); "tudo" usa os pesos de intensidade
    const v = metric === "all" ? e.weight : 1;
    if (e.side === "home") {
      b.home += v;
      b.homeEvents.push(e);
    } else {
      b.away += v;
      b.awayEvents.push(e);
    }
  }
  return bins;
}

export function totals(events: ActivityEvent[]) {
  const t = {
    home: { shots: 0, onTarget: 0, corners: 0, fouls: 0, cards: 0, goals: 0 },
    away: { shots: 0, onTarget: 0, corners: 0, fouls: 0, cards: 0, goals: 0 },
  };
  for (const e of events) {
    if (!e.side) continue;
    const s = t[e.side];
    if (e.kind === "shot" || e.kind === "goal") s.shots++;
    if (e.onTarget && (e.kind === "shot" || e.kind === "goal")) s.onTarget++;
    if (e.kind === "goal") s.goals++;
    if (e.kind === "corner") s.corners++;
    if (e.kind === "foul") s.fouls++;
    if (e.kind === "card") s.cards++;
  }
  return t;
}
