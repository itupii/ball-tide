import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getScoreboard, type MatchSummary } from "@/lib/espn.functions";
import { LiveBadge, TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";
import { RefreshCw, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jogos ao vivo e placares — RadarFC" },
      { name: "description", content: "Placares de futebol ao vivo do mundo inteiro, gols, cartões e estatísticas atualizados a cada poucos segundos." },
      { property: "og:title", content: "Jogos ao vivo e placares — RadarFC" },
      { property: "og:description", content: "Placares ao vivo, estatísticas e probabilidades de futebol do mundo inteiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

const scoreboardQuery = (date: string, live: boolean) =>
  queryOptions({
    queryKey: ["scoreboard", date],
    queryFn: () => getScoreboard({ data: { date } }),
    refetchInterval: live ? 15_000 : 60_000,
  });

type Filter = "all" | "in" | "pre" | "post";

function Index() {
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = -2; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);
  const [date, setDate] = useState(ymd(new Date()));
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const isToday = date === ymd(new Date());
  const { data, isLoading, isFetching, refetch } = useQuery(scoreboardQuery(date, isToday));
  const matches = data?.matches ?? [];

  // detect new goals to flash rows
  const prev = useRef<Record<string, string>>({});
  const [flash, setFlash] = useState<Set<string>>(new Set());
  useEffect(() => {
    const next: Record<string, string> = {};
    const changed = new Set<string>();
    for (const m of matches) {
      const k = `${m.home.score}-${m.away.score}`;
      next[m.id] = k;
      if (prev.current[m.id] && prev.current[m.id] !== k && m.state === "in") changed.add(m.id);
    }
    prev.current = next;
    if (changed.size) {
      setFlash(changed);
      const t = setTimeout(() => setFlash(new Set()), 2600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [matches]);

  const filtered = matches.filter(
    (m) =>
      (filter === "all" || m.state === filter) &&
      (!q || `${m.home.name} ${m.away.name} ${m.league}`.toLowerCase().includes(q.toLowerCase())),
  );
  const groups = useMemo(() => {
    const g = new Map<string, MatchSummary[]>();
    for (const m of filtered) {
      const k = m.league || "Outras competições";
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(m);
    }
    return [...g.entries()].sort((a, b) => {
      const la = a[1].some((m) => m.state === "in") ? 0 : 1;
      const lb = b[1].some((m) => m.state === "in") ? 0 : 1;
      return la - lb || a[0].localeCompare(b[0]);
    });
  }, [filtered]);
  const liveCount = matches.filter((m) => m.state === "in").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
            Jogos <span className="text-primary">do dia</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {matches.length} partidas · {liveCount} ao vivo · atualização automática a cada {isToday ? "15" : "60"}s
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:border-primary/60">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Atualizar
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const k = ymd(d);
          const today = k === ymd(new Date());
          return (
            <button
              key={k}
              onClick={() => setDate(k)}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center rounded-md border px-3 py-2 text-xs transition-colors",
                date === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
              )}
            >
              <span className="uppercase">{today ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
              <span className="tabular text-sm font-bold">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "Todos"],
            ["in", `Ao vivo (${liveCount})`],
            ["pre", "Próximos"],
            ["post", "Encerrados"],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn("rounded-full border px-3 py-1 text-sm", filter === k ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {l}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar time ou liga"
            className="h-9 w-full rounded-md border bg-card pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {data?.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{data.error}</p>}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-card" />
          ))}
        </div>
      )}
      {!isLoading && groups.length === 0 && <p className="py-12 text-center text-muted-foreground">Nenhuma partida encontrada.</p>}

      <div className="space-y-4">
        {groups.map(([league, ms]) => (
          <div key={league} className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b bg-surface px-4 py-2">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider">{league}</h3>
              <span className="text-xs text-muted-foreground">{ms.length}</span>
            </div>
            <ul className="divide-y">
              {ms.map((m) => (
                <MatchRow key={m.id} m={m} flash={flash.has(m.id)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchRow({ m, flash }: { m: MatchSummary; flash: boolean }) {
  const time = new Date(m.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const reds = m.events.filter((e) => e.red).length;
  return (
    <li className={cn(flash && "flash-goal")}>
      <Link to="/jogo/$id" params={{ id: m.id }} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/60">
        <div className="text-xs">
          {m.state === "in" ? (
            <LiveBadge text={m.clock || m.status} />
          ) : m.state === "post" ? (
            <span className="text-muted-foreground">{m.status || "Fim"}</span>
          ) : (
            <span className="tabular text-muted-foreground">{time}</span>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          {[m.home, m.away].map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <TeamLogo src={t.logo} alt={t.name} size={18} />
              <span className={cn("truncate text-sm", m.state === "post" && t.winner && "font-semibold")}>{t.name}</span>
              {t.form && <span className="hidden text-[10px] tracking-widest text-muted-foreground md:inline">{t.form}</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {reds > 0 && <span className="inline-block h-3 w-2 rounded-[1px] bg-loss" title="Cartão vermelho" />}
          {m.odds?.home && (
            <div className="tabular hidden text-[11px] text-muted-foreground sm:block">
              1 {m.odds.home} · X {m.odds.draw} · 2 {m.odds.away}
            </div>
          )}
          <div className="tabular w-6 space-y-1 text-right text-sm font-bold">
            <div className={cn(m.state === "in" && "text-primary")}>{m.home.score ?? "-"}</div>
            <div className={cn(m.state === "in" && "text-primary")}>{m.away.score ?? "-"}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}
