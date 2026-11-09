import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MatchXg, PlayerRank, TeamSeason, TeamXpts } from "./providers/types";

/* Tudo aqui roda só no servidor: o token da Sportmonks nunca vai para o navegador. */
type Fail = { ok: false; reason: "not_configured" | "error"; message: string };
type Ok<T> = { ok: true; data: T };

async function guard<T>(
  fn: (sm: typeof import("./providers/sportmonks")) => Promise<T>,
): Promise<Ok<T> | Fail> {
  const sm = await import("./providers/sportmonks");
  if (!sm.sportmonksConfigured())
    return {
      ok: false,
      reason: "not_configured",
      message: "Defina SPORTMONKS_API_TOKEN no servidor para ativar os dados de jogadores e xG.",
    };
  try {
    return { ok: true, data: await fn(sm) };
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
    guard((sm) => sm.sportmonks.topPlayers!(data.metric)),
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
    guard((sm) => sm.sportmonks.matchXg!(data)),
  );

export const getLeagueXpts = createServerFn({ method: "GET" }).handler(
  (): Promise<Ok<TeamXpts[]> | Fail> => guard((sm) => sm.sportmonks.leagueXpts!()),
);

export const getTeamSeason = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ name: z.string().min(2).max(80) }).parse(d))
  .handler(({ data }): Promise<Ok<TeamSeason | null> | Fail> =>
    guard((sm) => sm.sportmonks.teamSeason!(data.name)),
  );
