import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  Bar as RBar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { PastGame } from "@/lib/espn.functions";
import type { TeamRank } from "@/lib/league-stats";
import type { PlayerRank } from "@/lib/providers/types";
import { cn } from "@/lib/utils";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false } as const;
const grid = { stroke: "var(--border)", strokeDasharray: "3 4", opacity: 0.6 } as const;

function TipBox({ children }: { children: React.ReactNode }) {
  return <div className="glass rounded-lg border px-3 py-2 text-xs shadow-xl">{children}</div>;
}

/* ---------------- Liga: dispersão ataque x defesa ---------------- */

type AxisKey = "gfPg" | "gaPg" | "aproveitamento" | "sgPg" | "luck";
const AXES: { key: AxisKey; label: string; better: "high" | "low" }[] = [
  { key: "gfPg", label: "Gols pró/jogo", better: "high" },
  { key: "gaPg", label: "Gols contra/jogo", better: "low" },
  { key: "aproveitamento", label: "Aproveitamento %", better: "high" },
  { key: "sgPg", label: "Saldo/jogo", better: "high" },
  { key: "luck", label: "Pontos − xPts", better: "high" },
];

export function LeagueScatter({ teams }: { teams: TeamRank[] }) {
  const nav = useNavigate();
  const [x, setX] = useState<AxisKey>("gaPg");
  const [y, setY] = useState<AxisKey>("gfPg");
  const [hover, setHover] = useState<string | null>(null);
  const ax = AXES.find((a) => a.key === x)!;
  const ay = AXES.find((a) => a.key === y)!;
  const avg = (k: AxisKey) => teams.reduce((s, t) => s + t[k], 0) / Math.max(teams.length, 1);
  const data = useMemo(() => teams.map((t) => ({ ...t, px: t[x], py: t[y] })), [teams, x, y]);
  const good = (t: { px: number; py: number }) =>
    (ax.better === "high" ? t.px >= avg(x) : t.px <= avg(x)) &&
    (ay.better === "high" ? t.py >= avg(y) : t.py <= avg(y));

  const select = (value: AxisKey, set: (k: AxisKey) => void, label: string) => (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => set(e.target.value as AxisKey)}
        className="rounded-md border bg-card px-2 py-1 text-foreground"
      >
        {AXES.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {select(x, setX, "Eixo X")}
        {select(y, setY, "Eixo Y")}
        <span className="ml-auto text-xs text-muted-foreground">
          Clique num time para abrir o perfil
        </span>
      </div>
      <div
        className="h-80 w-full"
        role="img"
        aria-label={`Dispersão: ${ay.label} por ${ax.label}, uma bolinha por time. Os mesmos dados estão na tabela abaixo.`}
      >
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis
              type="number"
              dataKey="px"
              name={ax.label}
              reversed={ax.better === "low"}
              domain={["auto", "auto"]}
              {...axis}
              label={{
                value: ax.label + (ax.better === "low" ? " (menor é melhor →)" : ""),
                position: "insideBottom",
                offset: -8,
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="py"
              name={ay.label}
              reversed={ay.better === "low"}
              domain={["auto", "auto"]}
              {...axis}
              width={44}
            />
            <ZAxis range={[90, 90]} />
            <ReferenceLine
              x={avg(x)}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <ReferenceLine
              y={avg(y)}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "var(--primary)" }}
              content={({ active, payload }) => {
                const t = active
                  ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                  : undefined;
                if (!t) return null;
                return (
                  <TipBox>
                    <div className="font-display text-sm font-semibold uppercase">{t.team}</div>
                    <div className="tabular text-muted-foreground">
                      {t.rank}º · {t.points} pts · {t.played} jogos
                    </div>
                    <div className="tabular mt-1">
                      {ax.label}: <b>{t.px}</b>
                    </div>
                    <div className="tabular">
                      {ay.label}: <b>{t.py}</b>
                    </div>
                  </TipBox>
                );
              }}
            />
            <Scatter
              data={data}
              onClick={(d: unknown) => {
                const id = (d as { teamId?: string })?.teamId;
                if (id) void nav({ to: "/time/$id", params: { id } });
              }}
              onMouseEnter={(d: unknown) => setHover((d as { teamId?: string })?.teamId ?? null)}
              onMouseLeave={() => setHover(null)}
              isAnimationActive
              animationDuration={700}
            >
              {data.map((t) => (
                <Cell
                  key={t.group + t.teamId}
                  fill={good(t) ? "var(--primary)" : "var(--chart-3)"}
                  fillOpacity={hover && hover !== t.teamId ? 0.3 : 0.9}
                  stroke="var(--background)"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer", transition: "fill-opacity .2s" }}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" /> melhor
        que a média nos dois eixos ·{" "}
        <span
          className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: "var(--chart-3)" }}
        />{" "}
        demais times. Linhas tracejadas: média da liga.
      </p>
    </div>
  );
}

/* ---------------- Jogadores: barras interativas ---------------- */

export function PlayerBars({ rows, label }: { rows: PlayerRank[]; label: string }) {
  const [showXg, setShowXg] = useState(true);
  const hasXg = rows.some((r) => r.xg != null);
  const data = rows
    .slice(0, 10)
    .map((r) => ({ name: r.name, team: r.team, value: r.value, xg: r.xg ?? null }));
  return (
    <div>
      {hasXg && (
        <label className="mb-2 flex w-fit items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showXg}
            onChange={(e) => setShowXg(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Comparar com xG
        </label>
      )}
      <div
        className="h-[22rem] w-full"
        role="img"
        aria-label={`Gráfico de barras: ${label} dos 10 primeiros. Dados completos na tabela.`}
      >
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
            barGap={3}
          >
            <CartesianGrid {...grid} horizontal={false} />
            <XAxis type="number" {...axis} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} {...axis} fontSize={12} />
            <Tooltip
              cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const p = active ? payload?.[0]?.payload : undefined;
                if (!p) return null;
                return (
                  <TipBox>
                    <div className="font-display text-sm font-semibold uppercase">{p.name}</div>
                    <div className="text-muted-foreground">{p.team}</div>
                    <div className="tabular mt-1">
                      {label}: <b>{p.value}</b>
                    </div>
                    {p.xg != null && (
                      <div className="tabular">
                        xG: <b>{p.xg}</b> · diferença <b>{(p.value - p.xg).toFixed(1)}</b>
                      </div>
                    )}
                  </TipBox>
                );
              }}
            />
            <RBar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
              {data.map((_, i) => (
                <Cell key={i} fill="var(--primary)" fillOpacity={1 - i * 0.045} />
              ))}
            </RBar>
            {hasXg && showXg && (
              <RBar
                dataKey="xg"
                fill="var(--accent)"
                radius={[0, 6, 6, 0]}
                animationDuration={800}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------- Time: tendência de gols com zoom e legenda clicável ---------------- */

export function TeamTrend({ games }: { games: PastGame[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const data = useMemo(
    () =>
      [...games].reverse().map((g, i) => ({
        i: i + 1,
        label: new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        pro: g.goalsFor,
        contra: g.goalsAgainst,
        saldo: g.goalsFor - g.goalsAgainst,
        opp: g.opponent,
        res: g.result,
        local: g.homeAway === "home" ? "Casa" : "Fora",
      })),
    [games],
  );
  if (data.length < 2) return null;
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const series = [
    { k: "pro", label: "Gols marcados", color: "var(--primary)" },
    { k: "contra", label: "Gols sofridos", color: "var(--loss)" },
  ];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Séries do gráfico">
        {series.map((s) => (
          <button
            key={s.k}
            type="button"
            aria-pressed={!hidden.has(s.k)}
            onClick={() => toggle(s.k)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-opacity",
              hidden.has(s.k) && "opacity-40",
            )}
          >
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          Arraste a barra inferior para dar zoom
        </span>
      </div>
      <div
        className="h-72 w-full"
        role="img"
        aria-label="Gols marcados e sofridos por jogo, do mais antigo ao mais recente. Resultados completos na lista abaixo."
      >
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--primary)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = active ? payload?.[0]?.payload : undefined;
                if (!p) return null;
                return (
                  <TipBox>
                    <div className="font-display text-sm font-semibold uppercase">
                      {p.local} · {p.opp}
                    </div>
                    <div className="tabular text-muted-foreground">{p.label}</div>
                    <div className="tabular mt-1 text-base font-bold">
                      {p.pro} – {p.contra}{" "}
                      <span
                        className={cn(
                          "text-xs",
                          p.res === "W"
                            ? "text-win"
                            : p.res === "L"
                              ? "text-loss"
                              : "text-muted-foreground",
                        )}
                      >
                        {p.res === "W" ? "Vitória" : p.res === "L" ? "Derrota" : "Empate"}
                      </span>
                    </div>
                  </TipBox>
                );
              }}
            />
            {!hidden.has("pro") && (
              <Area
                type="monotone"
                dataKey="pro"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#gPro)"
                dot={{ r: 3, fill: "var(--primary)" }}
                activeDot={{ r: 6 }}
                animationDuration={800}
              />
            )}
            {!hidden.has("contra") && (
              <Line
                type="monotone"
                dataKey="contra"
                stroke="var(--loss)"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: "var(--loss)" }}
                activeDot={{ r: 6 }}
                animationDuration={800}
              />
            )}
            {data.length > 8 && (
              <Brush
                dataKey="label"
                height={22}
                stroke="var(--primary)"
                fill="var(--card)"
                travellerWidth={8}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------- Partida: barra 1X2 animada ---------------- */

export function WinProbBar({
  home,
  draw,
  away,
  homeLabel,
  awayLabel,
}: {
  home: number;
  draw: number;
  away: number;
  homeLabel: string;
  awayLabel: string;
}) {
  const parts = [
    { k: "home", label: homeLabel, v: home, cls: "bg-primary text-primary-foreground" },
    { k: "draw", label: "Empate", v: draw, cls: "bg-secondary text-secondary-foreground" },
    { k: "away", label: awayLabel, v: away, cls: "bg-accent text-accent-foreground" },
  ];
  return (
    <div
      className="mt-5"
      role="img"
      aria-label={`Probabilidades: ${homeLabel} ${home}%, empate ${draw}%, ${awayLabel} ${away}%`}
    >
      <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.k}
            title={`${p.label}: ${p.v}%`}
            className={cn(
              "bar-grow flex items-center justify-center text-[11px] font-bold transition-[flex-grow] duration-500 hover:brightness-110",
              p.cls,
            )}
            style={{ flexGrow: Math.max(p.v, 4), flexBasis: 0 }}
          >
            {p.v >= 12 ? `${Math.round(p.v)}%` : ""}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{homeLabel}</span>
        <span>Empate</span>
        <span>{awayLabel}</span>
      </div>
    </div>
  );
}
