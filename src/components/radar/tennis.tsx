import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  matchProbability,
  rankOf,
  playerResults,
  recentForm,
  headToHead,
  type PlayerResult,
  type Prob,
  type RankEntry,
  type TennisMatch,
  type TennisPlayerRef,
} from "@/lib/tennis-model";
import { TeamLogo } from "@/components/radar/ui";
import { cn } from "@/lib/utils";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false } as const;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function PlayerLink({
  p,
  tour,
  className,
}: {
  p: TennisPlayerRef;
  tour: string;
  className?: string;
}) {
  return (
    <Link
      to="/tenis/jogador/$id"
      params={{ id: p.id }}
      search={{ tour: tour === "wta" ? "wta" : "atp" }}
      className={cn("flex min-w-0 items-center gap-2 hover:text-primary", className)}
    >
      <TeamLogo src={p.flag} alt={p.name} size={18} />
      <span className="truncate">{p.name}</span>
    </Link>
  );
}

/** Barra de probabilidade de dois lados, com rótulos e animação. */
export function TennisProbBar({
  a,
  b,
  nameA,
  nameB,
}: {
  a: number;
  b: number;
  nameA: string;
  nameB: string;
}) {
  return (
    <div role="img" aria-label={`Probabilidade de vitória: ${nameA} ${pct(a)}, ${nameB} ${pct(b)}`}>
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full">
        <div
          className="bar-grow flex items-center justify-center bg-primary text-[11px] font-bold text-primary-foreground"
          style={{ flexGrow: a * 100, flexBasis: 0 }}
        >
          {a >= 0.14 ? pct(a) : ""}
        </div>
        <div
          className="bar-grow flex items-center justify-center bg-accent text-[11px] font-bold text-accent-foreground"
          style={{ flexGrow: b * 100, flexBasis: 0 }}
        >
          {b >= 0.14 ? pct(b) : ""}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{nameA}</span>
        <span>{nameB}</span>
      </div>
    </div>
  );
}

const CONF: Record<Prob["confidence"], string> = {
  alta: "text-win",
  média: "text-draw",
  baixa: "text-loss",
};

export function ProbBreakdown({
  prob,
  nameA,
  nameB,
}: {
  prob: Prob;
  nameA: string;
  nameB: string;
}) {
  if (prob.insufficient)
    return (
      <p className="text-sm text-muted-foreground">
        Dados insuficientes: sem ranking carregado e com poucos jogos recentes para estes jogadores.
        A estimativa aparece quando um deles tiver ranking ou histórico.
      </p>
    );
  return (
    <div className="space-y-3">
      <TennisProbBar a={prob.a} b={prob.b} nameA={nameA} nameB={nameB} />
      <ul className="divide-y text-sm">
        {prob.factors.map((f) => (
          <li key={f.label} className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">{f.label}</span>
            <span className="tabular font-semibold">
              {f.pp === 0
                ? "neutro"
                : `${f.pp > 0 ? "+" : ""}${f.pp} pp a favor de ${f.pp > 0 ? nameA : nameB}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Confiança: <b className={CONF[prob.confidence]}>{prob.confidence}</b>. Estimativa
        estatística por ranking, forma recente e confronto direto; não considera piso, lesões nem
        condições do jogo.
      </p>
    </div>
  );
}

function Score({ m }: { m: TennisMatch }) {
  const n = Math.max(m.setsA.length, m.setsB.length);
  if (!n) return null;
  return (
    <div
      className="grid gap-x-3 text-right text-sm"
      style={{ gridTemplateColumns: `repeat(${n}, 1.25rem)` }}
    >
      {[m.setsA, m.setsB].map((s, r) =>
        Array.from({ length: n }).map((_, i) => (
          <span
            key={`${r}-${i}`}
            className={cn(
              "tabular",
              (r === 0 ? m.setsA[i]! > (m.setsB[i] ?? 0) : (m.setsB[i] ?? 0) > (m.setsA[i] ?? 0))
                ? "font-bold"
                : "text-muted-foreground",
            )}
          >
            {s[i] ?? ""}
          </span>
        )),
      )}
    </div>
  );
}

export function MatchCard({
  m,
  rankMap,
  all,
  index = 0,
}: {
  m: TennisMatch;
  rankMap: Map<string, RankEntry>;
  all: TennisMatch[];
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const prob = useMemo(() => matchProbability(m, rankMap, all), [m, rankMap, all]);
  const ra = rankOf(rankMap, m.a);
  const rb = rankOf(rankMap, m.b);
  const fa = recentForm(playerResults(all, m.a.id, m.date));
  const fb = recentForm(playerResults(all, m.b.id, m.date));
  const h2h = headToHead(
    all.filter((x) => Date.parse(x.date) < Date.parse(m.date)),
    m.a.id,
    m.b.id,
  );
  const done = m.state === "post";
  const row = (p: TennisPlayerRef, r: RankEntry | undefined, win: boolean, pr: number) => (
    <div className="flex items-center gap-3">
      <PlayerLink p={p} tour={m.tour} className={cn("flex-1 text-sm", win && "font-semibold")} />
      {r && <span className="tabular text-[11px] text-muted-foreground">#{r.rank}</span>}
      {!done && (
        <span
          className="tabular w-11 text-right text-sm font-semibold text-primary"
          title={prob.insufficient ? "Dados insuficientes para estimar" : undefined}
        >
          {prob.insufficient ? "n/d" : pct(pr)}
        </span>
      )}
    </div>
  );
  return (
    <div
      className="surface-card reveal overflow-hidden rounded-xl"
      style={{ ["--i" as string]: Math.min(index, 8) }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 border-l-2 border-transparent px-4 py-3 text-left transition-all hover:border-primary hover:bg-secondary/60"
      >
        <div className="text-xs text-muted-foreground">
          <div className={cn("font-semibold", m.state === "in" && "text-loss")}>
            {m.state === "in" ? "AO VIVO" : done ? "Fim" : fmtTime(m.date)}
          </div>
          <div className="truncate">{m.round}</div>
        </div>
        <div className="space-y-1.5">
          {row(m.a, ra, m.winner === "a", prob.a)}
          {row(m.b, rb, m.winner === "b", prob.b)}
        </div>
        <Score m={m} />
      </button>
      {open && (
        <div className="space-y-4 border-t bg-surface/60 px-4 py-4">
          {!done && <ProbBreakdown prob={prob} nameA={m.a.shortName} nameB={m.b.shortName} />}
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1 text-left">{m.a.shortName}</th>
                <th className="py-1 text-center font-normal"></th>
                <th className="py-1 text-right">{m.b.shortName}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[
                ["Ranking", ra ? `#${ra.rank}` : "—", rb ? `#${rb.rank}` : "—"],
                ["Pontos", ra?.points ?? "—", rb?.points ?? "—"],
                [
                  "Forma (últ. 10)",
                  fa.n ? `${fa.wins}V-${fa.n - fa.wins}D` : "—",
                  fb.n ? `${fb.wins}V-${fb.n - fb.wins}D` : "—",
                ],
                ["Confronto direto", h2h.a, h2h.b],
              ].map(([l, x, y]) => (
                <tr key={String(l)} className="border-t">
                  <td className="py-1.5 text-left font-semibold">{x}</td>
                  <td className="py-1.5 text-center text-xs text-muted-foreground">{l}</td>
                  <td className="py-1.5 text-right font-semibold">{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            {m.tournament} · {m.group}. Forma e confronto direto consideram os últimos 14 dias de
            jogos do circuito.
          </p>
        </div>
      )}
    </div>
  );
}

export function PointsChart({ rankings }: { rankings: RankEntry[] }) {
  const data = rankings.slice(0, 12).map((r) => ({
    name: r.name.split(" ").slice(-1)[0],
    full: r.name,
    points: r.points,
    rank: r.rank,
  }));
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Pontos de ranking dos 12 primeiros. Tabela completa ao lado."
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 4"
            vertical={false}
            opacity={0.6}
          />
          <XAxis dataKey="name" {...axis} interval={0} angle={-30} textAnchor="end" height={56} />
          <YAxis {...axis} />
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : undefined;
              return p ? (
                <div className="glass rounded-lg border px-3 py-2 text-xs shadow-xl">
                  <div className="font-display text-sm font-semibold uppercase">{p.full}</div>
                  <div className="tabular text-muted-foreground">
                    #{p.rank} · {p.points} pontos
                  </div>
                </div>
              ) : null;
            }}
          />
          <RBar dataKey="points" radius={[6, 6, 0, 0]} animationDuration={800}>
            {data.map((_, i) => (
              <Cell key={i} fill="var(--primary)" fillOpacity={1 - i * 0.05} />
            ))}
          </RBar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Saldo de games por partida (verde = ganhou mais games). */
export function FormChart({ results }: { results: PlayerResult[] }) {
  const data = [...results].reverse().map((r) => ({
    label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    saldo: r.gamesFor - r.gamesAgainst,
    opp: r.opponent.name,
    score: r.score,
    won: r.won,
    tournament: r.tournament,
  }));
  if (data.length < 2)
    return <p className="text-sm text-muted-foreground">Poucos jogos na janela para o gráfico.</p>;
  return (
    <div
      className="h-56 w-full"
      role="img"
      aria-label="Saldo de games por partida, da mais antiga para a mais recente. Resultados completos na tabela."
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 4"
            vertical={false}
            opacity={0.6}
          />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} allowDecimals={false} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" />
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : undefined;
              return p ? (
                <div className="glass rounded-lg border px-3 py-2 text-xs shadow-xl">
                  <div className="font-display text-sm font-semibold uppercase">vs {p.opp}</div>
                  <div className="text-muted-foreground">{p.tournament}</div>
                  <div className="tabular mt-1">
                    <b className={p.won ? "text-win" : "text-loss"}>
                      {p.won ? "Vitória" : "Derrota"}
                    </b>{" "}
                    · {p.score}
                  </div>
                </div>
              ) : null;
            }}
          />
          <RBar dataKey="saldo" radius={4} animationDuration={800}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.won ? "var(--win)" : "var(--loss)"} />
            ))}
          </RBar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
