import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getOdds, LEAGUES, type OddsEvent } from "@/lib/odds.functions";
import { OddButton, Section } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/odds")({
  head: () => ({
    meta: [
      { title: "Comparador de odds de futebol — RadarFC" },
      { name: "description", content: "Compare odds de dezenas de casas de aposta e monte seu bilhete simulado." },
      { property: "og:title", content: "Comparador de odds de futebol — RadarFC" },
      { property: "og:description", content: "Melhores odds por mercado e simulação de bilhetes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OddsPage,
});

function best(ev: OddsEvent, market: string, name: string, point?: number) {
  let top: { price: number; book: string } | null = null;
  let sum = 0;
  let n = 0;
  for (const b of ev.bookmakers) {
    const mk = b.markets.find((m) => m.key === market);
    const o = mk?.outcomes.find((x) => x.name === name && (point == null || x.point === point));
    if (!o) continue;
    sum += o.price;
    n++;
    if (!top || o.price > top.price) top = { price: o.price, book: b.title };
  }
  return top ? { ...top, avg: +(sum / n).toFixed(2), count: n } : null;
}

function OddsPage() {
  const [sport, setSport] = useState(LEAGUES[0].key);
  const { data, isLoading } = useQuery({
    queryKey: ["odds", sport],
    queryFn: () => getOdds({ data: { sport } }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-bold uppercase">Comparador <span className="text-primary">de odds</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Maior odd entre as casas da Europa e Reino Unido. Clique para adicionar ao bilhete.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {LEAGUES.map((l) => (
          <button key={l.key} onClick={() => setSport(l.key)} className={cn("rounded-full border px-3 py-1 text-sm", sport === l.key ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
            {l.label}
          </button>
        ))}
      </div>
      {data?.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{data.error}</p>}
      {isLoading && <div className="h-40 animate-pulse rounded-lg bg-card" />}
      {data && !data.error && data.events.length === 0 && <p className="py-10 text-center text-muted-foreground">Sem jogos com odds nesta liga.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.events.map((ev) => {
          const label = `${ev.home} x ${ev.away}`;
          const mk = (market: string, pick: string, b: ReturnType<typeof best>) =>
            b && (
              <OddButton
                key={pick}
                label={pick}
                sub={b.book}
                sel={{ id: `odds:${ev.id}:${market}:${pick}`, matchId: `odds:${ev.id}`, match: label, market, pick, odds: b.price, modelPct: null, source: b.book, date: ev.commence }}
              />
            );
          const totalsPoint = ev.bookmakers.flatMap((b) => b.markets.filter((m) => m.key === "totals").flatMap((m) => m.outcomes.map((o) => o.point))).find((p) => p === 2.5) ?? 2.5;
          return (
            <Section
              key={ev.id}
              title={label}
              right={<span className="text-xs text-muted-foreground">{new Date(ev.commence).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>}
            >
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Resultado · {ev.bookmakers.length} casas</p>
              <div className="flex flex-wrap gap-2">
                {mk("Resultado final", ev.home, best(ev, "h2h", ev.home))}
                {mk("Resultado final", "Empate", best(ev, "h2h", "Draw"))}
                {mk("Resultado final", ev.away, best(ev, "h2h", ev.away))}
              </div>
              <p className="mb-2 mt-3 text-xs uppercase tracking-wider text-muted-foreground">Gols {totalsPoint}</p>
              <div className="flex flex-wrap gap-2">
                {mk("Gols", `Mais de ${totalsPoint}`, best(ev, "totals", "Over", totalsPoint))}
                {mk("Gols", `Menos de ${totalsPoint}`, best(ev, "totals", "Under", totalsPoint))}
              </div>
            </Section>
          );
        })}
      </div>
      {data?.remaining && <p className="text-xs text-muted-foreground">Consultas de odds restantes no mês: {data.remaining}</p>}
    </div>
  );
}
