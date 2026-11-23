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
const DAYS_BACK = 14;
const DAYS_AHEAD = 3;

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

async function loadHub(tour: Tour): Promise<TennisHub> {
  return cached(`tennis:hub:${tour}`, 10 * 60_000, async () => {
    const today = Date.now();
    const days = Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) =>
      ymd(new Date(today + (i - DAYS_BACK) * 86_400_000)),
    );
    const [boards, rank] = await Promise.all([
      Promise.allSettled(days.map((d) => getJson(`${SITE}/${tour}/scoreboard?dates=${d}`))),
      getJson(`${SITE}/${tour}/rankings`).catch(() => null),
    ]);
    const seen = new Map<string, TennisMatch>();
    for (const b of boards)
      if (b.status === "fulfilled")
        for (const m of parseScoreboard(b.value, tour)) seen.set(m.id, m);
    const matches = [...seen.values()].sort((x, y) => Date.parse(x.date) - Date.parse(y.date));
    const ok = boards.some((b) => b.status === "fulfilled");
    return {
      matches,
      rankings: rank ? parseRankings(rank) : [],
      fetchedAt: new Date().toISOString(),
      error: ok ? null : "Não foi possível carregar o tênis agora.",
    };
  });
}

const hubIn = (d: unknown) => z.object({ tour: z.enum(["atp", "wta"]) }).parse(d);
const hubServer = createServerFn({ method: "GET" })
  .inputValidator(hubIn)
  .handler(({ data }) => loadHub(data.tour));

/** Servidor primeiro; se a fonte bloquear o servidor, tenta do navegador (mesmo padrão das demais funções). */
export async function getTennisHub({ data }: { data: { tour: Tour } }): Promise<TennisHub> {
  const r = await hubServer({ data }).catch(() => null);
  if (r && (r.matches.length || r.rankings.length)) return r;
  return typeof window !== "undefined"
    ? loadHub(hubIn(data).tour)
    : (r ?? loadHub(hubIn(data).tour));
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
