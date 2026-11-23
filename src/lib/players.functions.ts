import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MatchXg, PlayerRank, StatsProvider, TeamSeason, TeamXpts } from "./providers/types";

/* Tudo aqui roda só no servidor: tokens dos provedores nunca vão para o navegador. */
type Fail = { ok: false; reason: "not_configured" | "unsupported" | "error"; message: string };
type Ok<T> = { ok: true; data: T };

/** Escolhe o provedor configurado: Sportmonks (pago, com xG) tem prioridade; senão football-data.org (grátis). */
async function pickProvider(): Promise<StatsProvider | null> {
  const sm = await import("./providers/sportmonks");
  if (sm.sportmonksConfigured()) return sm.sportmonks;
  const fd = await import("./providers/footballdata");
  if (fd.footballDataConfigured()) return fd.footballData;
  return null;
}

async function guard<T>(
  need: string,
  pick: (p: StatsProvider) => (() => Promise<T>) | undefined,
): Promise<Ok<T> | Fail> {
  const p = await pickProvider();
  if (!p)
    return {
      ok: false,
      reason: "not_configured",
      message:
        "Defina FOOTBALL_DATA_API_KEY (gratuito, football-data.org) ou SPORTMONKS_API_TOKEN (pago, com xG) no servidor para ativar os dados de jogadores.",
    };
  const run = pick(p);
  if (!run)
    return {
      ok: false,
      reason: "unsupported",
      message: `${need} exige o provedor Sportmonks (plano pago com xG). O provedor gratuito não entrega esse dado.`,
    };
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Falha ao consultar o provedor.",
    };
  }
}

export const getTopPlayers = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ metric: z.enum(["goals", "assists"]) }).parse(d))
  .handler(({ data }): Promise<Ok<PlayerRank[]> | Fail> =>
    guard("Ranking de jogadores", (p) =>
      p.topPlayers ? () => p.topPlayers!(data.metric) : undefined,
    ),
  );

export const getMatchXg = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        home: z.string().min(1).max(80),
        away: z.string().min(1).max(80),
      })
      .parse(d),
  )
  .handler(({ data }): Promise<Ok<MatchXg | null> | Fail> =>
    guard("xG da partida", (p) => (p.matchXg ? () => p.matchXg!(data) : undefined)),
  );

export const getLeagueXpts = createServerFn({ method: "GET" }).handler(
  (): Promise<Ok<TeamXpts[]> | Fail> =>
    guard("xPts", (p) => (p.leagueXpts ? () => p.leagueXpts!() : undefined)),
);

export const getTeamSeason = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ name: z.string().min(2).max(80) }).parse(d))
  .handler(({ data }): Promise<Ok<TeamSeason | null> | Fail> =>
    guard("Elenco", (p) => (p.teamSeason ? () => p.teamSeason!(data.name) : undefined)),
  );
