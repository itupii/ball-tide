import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getTennisHistory, getTennisHub } from "@/lib/tennis.functions";
import { buildRankMap, type RankEntry, type TennisMatch, type Tour } from "@/lib/tennis-model";

/** Junta janela atual (hub) e histórico de ~6 meses, sem duplicar partidas, para forma, confronto direto e piso. */
export function useTennisData(tour: Tour | "all", playerId?: string) {
  const tours: Tour[] = tour === "all" ? ["atp", "wta"] : [tour];
  const hubs = useQueries({
    queries: tours.map((t) => ({
      queryKey: ["tennis-hub", t],
      queryFn: () => getTennisHub({ data: { tour: t } }),
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });
  const hist = useQueries({
    queries: tours.map((t) => ({
      queryKey: ["tennis-history", t, playerId ?? ""],
      queryFn: () => getTennisHistory({ data: playerId ? { tour: t, playerId } : { tour: t } }),
      staleTime: 30 * 60_000,
    })),
  });
  const hubKey = hubs.map((q) => q.dataUpdatedAt).join();
  const histKey = hist.map((q) => q.dataUpdatedAt).join();

  const matches = useMemo(
    () =>
      hubs
        .flatMap((q) => q.data?.matches ?? [])
        .sort((x, y) => Date.parse(x.date) - Date.parse(y.date)),
    [hubKey],
  );
  const rankings = useMemo(() => hubs.flatMap((q) => q.data?.rankings ?? []), [hubKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => {
    const m = new Map<string, TennisMatch>();
    for (const q of hist) for (const x of q.data ?? []) m.set(x.id, x);
    for (const x of matches) m.set(x.id, x); // a janela atual tem prioridade (dados completos)
    return [...m.values()];
  }, [histKey, matches]); // eslint-disable-line react-hooks/exhaustive-deps
  const rankingsByTour = useMemo(() => {
    const r: Record<Tour, RankEntry[]> = { atp: [], wta: [] };
    tours.forEach((t, i) => (r[t] = hubs[i]?.data?.rankings ?? []));
    return r;
  }, [hubKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const rankMap = useMemo(() => buildRankMap(rankings), [rankings]);

  return {
    matches,
    all,
    rankings,
    rankingsByTour,
    rankMap,
    isLoading: hubs.some((q) => q.isLoading),
    historyLoading: hist.some((q) => q.isLoading),
    historyCount: all.length - matches.length,
    error: hubs.every((q) => q.data?.error) ? (hubs[0]?.data?.error ?? null) : null,
  };
}
