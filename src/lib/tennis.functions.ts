import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cached } from "./providers/cache";
import {
  parseAthleteProfile,
  parseAthleteStats,
  parseRankings,
  parseScoreboard,
  type AthleteProfile,
  type RankEntry,
  type TennisMatch,
  type Tour,
} from "./tennis-model";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SITE = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports/tennis";
/** Janela de jogos carregada: dias passados (histórico/forma) e próximos (agenda). */

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} em ${url}`);
  return res.json();
}

const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

export interface TennisHub {
  matches: TennisMatch[];
  rankings: RankEntry[];
  fetchedAt: string;
  error: string | null;
}

/** O placar de uma data devolve TODOS os jogos dos torneios em andamento nela, então amostrar a cada ~3 dias cobre a janela com menos chamadas. */
const SAMPLE_OFFSETS = [-14, -11, -8, -5, -2, 0, 3];

async function loadMatches(tour: Tour): Promise<{ matches: TennisMatch[]; ok: boolean }> {
  return cached(
    `tennis:matches:${tour}`,
    10 * 60_000,
    async () => {
      const today = Date.now();
      const boards = await Promise.allSettled(
        SAMPLE_OFFSETS.map((o) =>
          getJson(`${SITE}/${tour}/scoreboard?dates=${ymd(new Date(today + o * 86_400_000))}`),
        ),
      );
      const seen = new Map<string, TennisMatch>();
      for (const b of boards)
        if (b.status === "fulfilled")
          for (const m of parseScoreboard(b.value, tour)) seen.set(m.id, m);
      return {
        matches: [...seen.values()].sort((x, y) => Date.parse(x.date) - Date.parse(y.date)),
        ok: boards.some((b) => b.status === "fulfilled"),
      };
    },
    (v) => v.matches.length > 0,
  );
}

/** Tenta vários endereços até obter ranking; só guarda em cache quando vier preenchido. */
export async function loadRankings(tour: Tour): Promise<RankEntry[]> {
  return cached(
    `tennis:rank:${tour}`,
    30 * 60_000,
    async () => {
      const urls = [
        `${SITE}/${tour}/rankings`,
        `https://site.web.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings?region=us&lang=en`,
        `${SITE}/${tour}/rankings?limit=300`,
      ];
      for (const u of urls) {
        try {
          const r = parseRankings(await getJson(u));
          if (r.length) return r;
        } catch {
          /* tenta o próximo endereço */
        }
      }
      return [] as RankEntry[];
    },
    (v) => v.length > 0,
  );
}

async function loadHub(tour: Tour): Promise<TennisHub> {
  const [m, rankings] = await Promise.all([loadMatches(tour), loadRankings(tour)]);
  return {
    matches: m.matches,
    rankings,
    fetchedAt: new Date().toISOString(),
    error: m.ok ? null : "Não foi possível carregar o tênis agora.",
  };
}

const hubIn = (d: unknown) => z.object({ tour: z.enum(["atp", "wta"]) }).parse(d);
const hubServer = createServerFn({ method: "GET" })
  .inputValidator(hubIn)
  .handler(({ data }) => loadHub(data.tour));

/** Servidor primeiro; o que vier vazio (jogos ou ranking) é completado direto do navegador. */
export async function getTennisHub({ data }: { data: { tour: Tour } }): Promise<TennisHub> {
  const tour = hubIn(data).tour;
  let hub = await hubServer({ data }).catch(() => null);
  if (typeof window !== "undefined") {
    if (!hub || !hub.matches.length) hub = await loadHub(tour);
    else if (!hub.rankings.length)
      hub = { ...hub, rankings: await loadRankings(tour).catch(() => []) };
  }
  return (
    hub ?? {
      matches: [],
      rankings: [],
      fetchedAt: new Date().toISOString(),
      error: "Não foi possível carregar o tênis agora.",
    }
  );
}

export interface TennisAthlete {
  profile: AthleteProfile | null;
  stats: { label: string; value: string }[];
}

async function loadAthlete(tour: Tour, id: string): Promise<TennisAthlete> {
  return cached(`tennis:athlete:${tour}:${id}`, 30 * 60_000, async () => {
    const [p, s] = await Promise.allSettled([
      getJson(`${WEB}/${tour}/athletes/${id}`),
      getJson(`${WEB}/${tour}/athletes/${id}/stats`),
    ]);
    return {
      profile: p.status === "fulfilled" ? parseAthleteProfile(p.value) : null,
      stats: s.status === "fulfilled" ? parseAthleteStats(s.value) : [],
    };
  });
}

const athIn = (d: unknown) =>
  z.object({ tour: z.enum(["atp", "wta"]), id: z.string().regex(/^\d{1,10}$/) }).parse(d);
const athServer = createServerFn({ method: "GET" })
  .inputValidator(athIn)
  .handler(({ data }) => loadAthlete(data.tour, data.id));

export async function getTennisAthlete({
  data,
}: {
  data: { tour: Tour; id: string };
}): Promise<TennisAthlete> {
  const r = await athServer({ data }).catch(() => null);
  if (r && (r.profile || r.stats.length)) return r;
  if (typeof window !== "undefined") {
    const v = athIn(data);
    return loadAthlete(v.tour, v.id);
  }
  return r ?? { profile: null, stats: [] };
}
