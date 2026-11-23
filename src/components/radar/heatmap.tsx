import { useMemo, useState } from "react";
import {
  binActivity,
  totals,
  type Activity,
  type ActivityEvent,
  type Metric,
} from "@/lib/activity";
import type { PastGame } from "@/lib/espn.functions";
import { cn } from "@/lib/utils";

/** Mistura a cor do tema com o fundo conforme a intensidade (0–1). */
const mix = (color: string, t: number) =>
  `color-mix(in oklab, ${color} ${Math.round(Math.min(1, Math.max(0, t)) * 100)}%, var(--card))`;

const METRICS: { key: Metric; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "shots", label: "Finalizações" },
  { key: "corners", label: "Escanteios" },
  { key: "fouls", label: "Faltas e cartões" },
];

const KIND_PT: Record<ActivityEvent["kind"], string> = {
  goal: "Gol",
  shot: "Finalização",
  corner: "Escanteio",
  foul: "Falta",
  card: "Cartão",
  offside: "Impedimento",
  sub: "Substituição",
  other: "Lance",
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex">
        {[0.15, 0.4, 0.65, 0.9].map((t) => (
          <i
            key={t}
            className="h-2.5 w-4 first:rounded-l last:rounded-r"
            style={{ background: mix(color, t) }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

/** Mapa de calor da atividade do jogo por faixa de minutos, só com dados reais do lance a lance (sem coordenadas). */
export function ActivityHeatmap({
  activity,
  home,
  away,
}: {
  activity: Activity;
  home: { name: string; short?: string };
  away: { name: string; short?: string };
}) {
  const [metric, setMetric] = useState<Metric>("all");
  const [sel, setSel] = useState<number | null>(null);
  const bins = useMemo(() => binActivity(activity.events, metric), [activity.events, metric]);
  const tot = useMemo(() => totals(activity.events), [activity.events]);
  const max = Math.max(...bins.flatMap((b) => [b.home, b.away]), 0.0001);
  const maxDom = Math.max(...bins.map((b) => Math.abs(b.home - b.away)), 0.0001);

  if (!activity.events.length)
    return (
      <p className="text-sm text-muted-foreground">
        A fonte (ESPN) ainda não enviou o lance a lance desta partida. O mapa aparece quando houver
        gols, finalizações, escanteios ou faltas registrados.
      </p>
    );

  const cols = `5.5rem repeat(${bins.length}, minmax(1.5rem, 1fr))`;
  const selBin = sel != null ? bins[sel] : null;
  const names = { home: home.short ?? home.name, away: away.short ?? away.name };

  const cell = (i: number, side: "home" | "away") => {
    const b = bins[i]!;
    const v = b[side];
    const goals = (side === "home" ? b.homeEvents : b.awayEvents).filter(
      (e) => e.kind === "goal",
    ).length;
    return (
      <button
        key={`${side}-${i}`}
        type="button"
        onClick={() => setSel(sel === i ? null : i)}
        aria-pressed={sel === i}
        aria-label={`${names[side]}, ${b.start} a ${b.end} minutos: ${metric === "all" ? v.toFixed(1) + " de intensidade" : v + " ocorrências"}${goals ? `, ${goals} gol(s)` : ""}`}
        title={`${names[side]} · ${b.start}'–${b.end}' · ${metric === "all" ? v.toFixed(1) : v}${goals ? ` · ${goals} gol(s)` : ""}`}
        className={cn(
          "relative h-9 rounded-md transition-transform hover:-translate-y-0.5 hover:ring-1 hover:ring-foreground/40",
          sel === i && "ring-2 ring-foreground",
        )}
        style={{
          background:
            v > 0
              ? mix(side === "home" ? "var(--primary)" : "var(--accent)", 0.12 + (v / max) * 0.85)
              : "var(--secondary)",
        }}
      >
        {goals > 0 && (
          <span
            className="absolute inset-0 grid place-items-center text-sm leading-none"
            aria-hidden="true"
          >
            ⚽
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Tipo de atividade"
      >
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              metric === m.key
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {activity.source === "commentary"
            ? "Fonte: lance a lance (ESPN)"
            : "Só lances-chave disponíveis (gols e cartões)"}
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[44rem] items-center gap-1"
          style={{ gridTemplateColumns: cols }}
        >
          <span />
          {bins.map((b) => (
            <span key={b.start} className="tabular text-center text-[10px] text-muted-foreground">
              {b.start}
            </span>
          ))}
          <span className="truncate pr-2 text-xs font-semibold">{names.home}</span>
          {bins.map((_, i) => cell(i, "home"))}
          <span className="truncate pr-2 text-xs font-semibold">{names.away}</span>
          {bins.map((_, i) => cell(i, "away"))}
          <span className="pr-2 text-xs text-muted-foreground">Domínio</span>
          {bins.map((b, i) => {
            const d = b.home - b.away;
            return (
              <i
                key={i}
                title={`${b.start}'–${b.end}' · ${d === 0 ? "equilibrado" : d > 0 ? `domínio ${names.home}` : `domínio ${names.away}`}`}
                className="h-3 rounded-sm"
                style={{
                  background:
                    d === 0
                      ? "var(--secondary)"
                      : mix(
                          d > 0 ? "var(--primary)" : "var(--accent)",
                          0.15 + (Math.abs(d) / maxDom) * 0.8,
                        ),
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Legend color="var(--primary)" label={names.home} />
        <Legend color="var(--accent)" label={names.away} />
        <span className="text-xs text-muted-foreground">
          ⚽ gol na faixa · clique numa faixa para ver os lances
        </span>
      </div>

      {selBin && (
        <div className="surface-card rounded-lg p-3 text-sm">
          <p className="mb-2 font-display text-sm font-semibold uppercase">
            {selBin.start}'–{selBin.end}'
          </p>
          {[
            ...selBin.homeEvents.map((e) => ({ e, s: names.home })),
            ...selBin.awayEvents.map((e) => ({ e, s: names.away })),
          ].length === 0 ? (
            <p className="text-muted-foreground">Sem lances nesta faixa para o filtro escolhido.</p>
          ) : (
            <ul className="divide-y">
              {[
                ...selBin.homeEvents.map((e) => ({ e, s: names.home })),
                ...selBin.awayEvents.map((e) => ({ e, s: names.away })),
              ]
                .sort((x, y) => x.e.minute - y.e.minute)
                .map(({ e, s }, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-1.5">
                    <span className="tabular w-8 text-muted-foreground">{e.minute}'</span>
                    <span className="font-semibold">{KIND_PT[e.kind]}</span>
                    <span className="text-muted-foreground">{e.player ?? ""}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{s}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <table className="w-full text-sm">
        <caption className="sr-only">Totais de atividade por time</caption>
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-1 text-left">{names.home}</th>
            <th className="py-1 text-center font-normal">Total</th>
            <th className="py-1 text-right">{names.away}</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {[
            ["Gols", tot.home.goals, tot.away.goals],
            ["Finalizações", tot.home.shots, tot.away.shots],
            ["No alvo", tot.home.onTarget, tot.away.onTarget],
            ["Escanteios", tot.home.corners, tot.away.corners],
            ["Faltas", tot.home.fouls, tot.away.fouls],
            ["Cartões", tot.home.cards, tot.away.cards],
          ].map(([l, h, a]) => (
            <tr key={String(l)} className="border-t">
              <td className="py-1.5 text-left font-semibold">{h}</td>
              <td className="py-1.5 text-center text-xs text-muted-foreground">{l}</td>
              <td className="py-1.5 text-right font-semibold">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- tênis e futebol: mapas de calor de resultados (dados reais já carregados) ---------------- */

const diffColor = (d: number, scale = 6) =>
  d === 0
    ? "var(--secondary)"
    : mix(
        d > 0 ? "var(--win)" : "var(--loss)",
        0.2 + (Math.min(Math.abs(d), scale) / scale) * 0.75,
      );

/** Games por set: cor pelo saldo de games (verde = quem está na linha ganhou o set). */
export function SetsHeat({
  rows,
}: {
  rows: {
    label: string;
    sets: { mine: number; theirs: number }[];
    won?: boolean | undefined;
    sub?: string | undefined;
  }[];
}) {
  const cols = Math.max(3, ...rows.map((r) => r.sets.length));
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[22rem] items-center gap-1"
        style={{ gridTemplateColumns: `minmax(8rem,1fr) repeat(${cols}, 2.75rem) 4.5rem` }}
      >
        <span />
        {Array.from({ length: cols }).map((_, i) => (
          <span key={i} className="text-center text-[10px] uppercase text-muted-foreground">
            Set {i + 1}
          </span>
        ))}
        <span className="text-right text-[10px] uppercase text-muted-foreground">Resultado</span>
        {rows.map((r, ri) => (
          <div key={ri} className="contents">
            <span className="min-w-0 pr-2 text-xs">
              <span className="block truncate font-semibold">{r.label}</span>
              {r.sub && <span className="block truncate text-muted-foreground">{r.sub}</span>}
            </span>
            {Array.from({ length: cols }).map((_, i) => {
              const s = r.sets[i];
              return s ? (
                <span
                  key={i}
                  className="tabular grid h-9 place-items-center rounded-md text-sm font-bold"
                  title={`Set ${i + 1}: ${s.mine}-${s.theirs}`}
                  style={{ background: diffColor(s.mine - s.theirs) }}
                >
                  {s.mine}-{s.theirs}
                </span>
              ) : (
                <span key={i} className="h-9 rounded-md bg-secondary/40" aria-hidden="true" />
              );
            })}
            {r.won == null ? (
              <span />
            ) : (
              <span
                className={cn("text-right text-xs font-semibold", r.won ? "text-win" : "text-loss")}
              >
                {r.won ? "Vitória" : "Derrota"}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Verde: set vencido; vermelho: set perdido. Quanto mais forte a cor, maior o saldo de games.
      </p>
    </div>
  );
}

/** Faixa de calor da forma recente de um time de futebol (cor = saldo de gols no jogo). */
export function FormHeatStrip({ games }: { games: PastGame[] }) {
  if (!games.length) return null;
  return (
    <div>
      <div
        className="flex flex-wrap gap-1.5"
        role="list"
        aria-label="Forma recente em mapa de calor"
      >
        {[...games].reverse().map((g, i) => (
          <div
            key={i}
            role="listitem"
            className="grid h-12 w-14 place-items-center rounded-md text-center leading-tight"
            style={{ background: diffColor(g.goalsFor - g.goalsAgainst, 3) }}
            title={`${new Date(g.date).toLocaleDateString("pt-BR")} · ${g.homeAway === "home" ? "Casa" : "Fora"} vs ${g.opponent}: ${g.goalsFor}-${g.goalsAgainst}`}
          >
            <span className="tabular text-sm font-bold">
              {g.goalsFor}-{g.goalsAgainst}
            </span>
            <span className="w-full truncate px-1 text-[9px] opacity-80">{g.opponent}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Do mais antigo ao mais recente. Verde: vitória por mais gols; vermelho: derrota por mais
        gols.
      </p>
    </div>
  );
}
