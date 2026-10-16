import { useQuery } from "@tanstack/react-query";
import {
  Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { profile, type Probabilities } from "@/lib/analytics";
import { teamHistoryQuery } from "@/components/radar/match-extras";
import { Section } from "@/components/radar/ui";

type T = { id: string; name: string; short: string; logo: string | null };
const C1 = "var(--primary)", C2 = "var(--accent)";
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "var(--foreground)" } };
const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };

export function MatchCharts({ home, away, pr }: { home: T; away: T; pr: Probabilities }) {
  const h = useQuery(teamHistoryQuery(home.id));
  const a = useQuery(teamHistoryQuery(away.id));
  const hg = (h.data?.games ?? []).slice(0, 20), ag = (a.data?.games ?? []).slice(0, 20);
  if (!hg.length || !ag.length) return <Section title="Gráficos comparativos"><p className="text-sm text-muted-foreground">Carregando gráficos…</p></Section>;
  const hp = profile(hg), ap = profile(ag);
  const radar = [
    ["Vitórias", hp.winPct, ap.winPct],
    ["Over 2.5", hp.over25, ap.over25],
    ["Ambas marcam", hp.btts, ap.btts],
    ["Sem sofrer", hp.cleanSheet, ap.cleanSheet],
    ["Ataque", Math.min(100, hp.gfAvg * 40), Math.min(100, ap.gfAvg * 40)],
    ["Defesa", Math.max(0, 100 - hp.gaAvg * 40), Math.max(0, 100 - ap.gaAvg * 40)],
  ].map(([k, x, y]) => ({ k, [home.short]: Math.round(x as number), [away.short]: Math.round(y as number) }));
  const bars = [
    ["Gols pró/j", hp.gfAvg, ap.gfAvg],
    ["Gols contra/j", hp.gaAvg, ap.gaAvg],
    ["Pontos/j", +(hp.points / (hp.games || 1)).toFixed(2), +(ap.points / (ap.games || 1)).toFixed(2)],
  ].map(([k, x, y]) => ({ k, [home.short]: x, [away.short]: y }));
  const n = Math.min(10, hg.length, ag.length);
  const trend = Array.from({ length: n }, (_, i) => {
    const x = hg[n - 1 - i]!, y = ag[n - 1 - i]!;
    return { j: `J${i + 1}`, [home.short]: x.goalsFor, [away.short]: y.goalsFor, [`${home.short} sofridos`]: x.goalsAgainst, [`${away.short} sofridos`]: y.goalsAgainst };
  });
  const probs = [
    { k: "1", v: pr.home }, { k: "X", v: pr.draw }, { k: "2", v: pr.away },
    { k: "+1.5", v: pr.over["1.5"] ?? 0 }, { k: "+2.5", v: pr.over["2.5"] ?? 0 }, { k: "+3.5", v: pr.over["3.5"] ?? 0 }, { k: "BTTS", v: pr.btts },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Perfil comparado (últimos 20)">
        <div className="h-64">
          <ResponsiveContainer>
            <RadarChart data={radar}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="k" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Radar name={home.short} dataKey={home.short} stroke={C1} fill={C1} fillOpacity={0.3} />
              <Radar name={away.short} dataKey={away.short} stroke={C2} fill={C2} fillOpacity={0.3} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip {...tip} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <Section title="Médias lado a lado">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={bars}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="k" {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tip} cursor={{ fill: "var(--surface)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <RBar dataKey={home.short} fill={C1} radius={[4, 4, 0, 0]} />
              <RBar dataKey={away.short} fill={C2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <Section title={`Gols marcados e sofridos — últimos ${n} jogos`}>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="j" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey={home.short} stroke={C1} strokeWidth={2} />
              <Line type="monotone" dataKey={away.short} stroke={C2} strokeWidth={2} />
              <Line type="monotone" dataKey={`${home.short} sofridos`} stroke={C1} strokeDasharray="4 4" />
              <Line type="monotone" dataKey={`${away.short} sofridos`} stroke={C2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <Section title="Probabilidades do modelo (%)">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={probs}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="k" {...axis} />
              <YAxis domain={[0, 100]} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "var(--surface)" }} />
              <RBar dataKey="v" name="Probabilidade" fill={C1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
