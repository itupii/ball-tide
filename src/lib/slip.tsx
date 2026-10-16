import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

export interface Selection {
  id: string; // unique per match+market+pick
  matchId: string;
  match: string;
  market: string;
  pick: string;
  odds: number;
  modelPct?: number | null;
  source: string;
  date?: string;
}

interface SlipCtx {
  items: Selection[];
  add: (s: Selection) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  totalOdds: number;
  stake: number;
  setStake: (n: number) => void;
}

const Ctx = createContext<SlipCtx | null>(null);
const KEY = "radar-slip-v1";

export function SlipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Selection[]>([]);
  const [stake, setStake] = useState(10);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setItems(p.items ?? []);
        setStake(p.stake ?? 10);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ items, stake }));
  }, [items, stake]);

  const value = useMemo<SlipCtx>(
    () => ({
      items,
      stake,
      setStake,
      add: (s) => {
        setItems((prev) => {
          const others = prev.filter((x) => !(x.matchId === s.matchId && x.market === s.market));
          return [...others, s];
        });
        toast.success("Adicionado ao bilhete", { description: `${s.pick} @ ${s.odds.toFixed(2)}` });
      },
      remove: (id) => setItems((p) => p.filter((x) => x.id !== id)),
      clear: () => setItems([]),
      has: (id) => items.some((x) => x.id === id),
      totalOdds: +items.reduce((a, x) => a * x.odds, 1).toFixed(2),
    }),
    [items, stake],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSlip() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSlip outside provider");
  return c;
}
