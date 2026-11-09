import { useEffect, useRef, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { getTeamHistory, type MatchSummary, type PastGame } from "@/lib/espn.functions";
import { disciplineStats, findPatterns, profile, type TeamProfile } from "@/lib/analytics";
import { Bar, FormPill, Section, TeamLogo } from "@/components/radar/ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const teamHistoryQuery = (id: string) =>
  queryOptions({
    queryKey: ["team", id],
    queryFn: () => getTeamHistory({ data: { teamId: id } }),
    staleTime: 10 * 60_000,
  });

/* ---------- Team evaluation (inline, no navigation) ---------- */

function extra(games: PastGame[]) {
  const n = games.length || 1;
  const tot = games.reduce((a, g) => a + g.goalsFor + g.goalsAgainst, 0);
  const pts = games.reduce((a, g) => a + (g.result === "W" ? 3 : g.result === "D" ? 1 : 0), 0);
  const big = games.filter((g) => g.goalsFor - g.goalsAgainst >= 2).length;
  const comeback = games.filter((g) => g.result !== "L" && g.goalsAgainst > 0).length;
  let unbeaten = 0;
  for (const g of games) {
    if (g.result === "L") break;
    unbeaten++;
  }
  let scoring = 0;
  for (const g of games) {
    if (g.goalsFor === 0) break;
    scoring++;
  }
  return {
    avgTotal: +(tot / n).toFixed(2),
    ppg: +(pts / n).toFixed(2),
    bigWins: Math.round((big / n) * 100),
    resilient: Math.round((comeback / n) * 100),
    unbeaten,
    scoring,
  };
}

function StatGrid({ items }: { items: [string, string | number][] }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-4">
      {items.map(([l, v]) => (
        <div key={l} className="rounded-md bg-surface p-2">
          <p className="tabular text-base font-bold">{v}</p>
          <p className="text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  );
}

function SplitRow({
  label,
  all,
  home,
  away,
}: {
  label: string;
  all: number | string;
  home: number | string;
  away: number | string;
}) {
  return (
    <tr className="border-b">
      <td className="py-1.5 text-muted-foreground">{label}</td>
      <td className="tabular py-1.5 text-right font-semibold">{all}</td>
      <td className="tabular py-1.5 text-right">{home}</td>
      <td className="tabular py-1.5 text-right">{away}</td>
    </tr>
  );
}

export function TeamEval({ team }: { team: { id: string; name: string; logo: string | null } }) {
  const { data, isLoading } = useQuery(teamHistoryQuery(team.id));
  const [win, setWin] = useState(10);
  if (isLoading)
    return (
      <Section title={team.name}>
        <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      </Section>
    );
  const games = (data?.games ?? []).slice(0, win);
  if (!games.length)
    return (
      <Section title={team.name}>
        <p className="text-sm text-muted-foreground">Sem histórico disponível.</p>
      </Section>
    );
  const p = profile(games),
    ph = profile(games, "home"),
    pa = profile(games, "away");
  const d = disciplineStats(games),
    dh = disciplineStats(games, "home"),
    da = disciplineStats(games, "away");
  const x = extra(games);
  const patterns = findPatterns(data?.games ?? []).slice(0, 6);
  const row = (k: keyof TeamProfile, suf = "%") =>
    [`${p[k]}${suf}`, `${ph[k]}${suf}`, `${pa[k]}${suf}`] as const;
  return (
    <Section
      title={team.name}
      right={
        <div className="flex gap-1">
          {[5, 10, 20, 40].map((w) => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                win === w
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-3">
        <TeamLogo src={team.logo} alt={team.name} size={36} />
        <div className="flex gap-1">
          {p.form.map((r, i) => (
            <FormPill key={i} r={r} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{p.streak}</span>
      </div>
      <StatGrid
        items={[
          ["Jogos", p.games],
          ["Pontos/jogo", x.ppg],
          ["Gols pró/j", p.gfAvg],
          ["Gols contra/j", p.gaAvg],
          ["Gols no jogo/j", x.avgTotal],
          ["Invicto há", x.unbeaten],
          ["Marcando há", x.scoring],
          ["Vitórias 2+ gols", `${x.bigWins}%`],
        ]}
      />
      <table className="mt-4 w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 text-left font-medium">Métrica</th>
            <th className="py-1 text-right font-medium">Geral</th>
            <th className="py-1 text-right font-medium">Casa</th>
            <th className="py-1 text-right font-medium">Fora</th>
          </tr>
        </thead>
        <tbody>
          <SplitRow
            label="Vitórias"
            all={row("winPct")[0]}
            home={row("winPct")[1]}
            away={row("winPct")[2]}
          />
          <SplitRow
            label="Empates"
            all={row("drawPct")[0]}
            home={row("drawPct")[1]}
            away={row("drawPct")[2]}
          />
          <SplitRow
            label="Derrotas"
            all={row("lossPct")[0]}
            home={row("lossPct")[1]}
            away={row("lossPct")[2]}
          />
          <SplitRow label="Gols pró/j" all={p.gfAvg} home={ph.gfAvg} away={pa.gfAvg} />
          <SplitRow label="Gols contra/j" all={p.gaAvg} home={ph.gaAvg} away={pa.gaAvg} />
          <SplitRow
            label="Over 1.5"
            all={row("over15")[0]}
            home={row("over15")[1]}
            away={row("over15")[2]}
          />
          <SplitRow
            label="Over 2.5"
            all={row("over25")[0]}
            home={row("over25")[1]}
            away={row("over25")[2]}
          />
          <SplitRow
            label="Over 3.5"
            all={row("over35")[0]}
            home={row("over35")[1]}
            away={row("over35")[2]}
          />
          <SplitRow
            label="Ambas marcam"
            all={row("btts")[0]}
            home={row("btts")[1]}
            away={row("btts")[2]}
          />
          <SplitRow
            label="Sem sofrer gol"
            all={row("cleanSheet")[0]}
            home={row("cleanSheet")[1]}
            away={row("cleanSheet")[2]}
          />
          <SplitRow
            label="Não marcou"
            all={row("failedToScore")[0]}
            home={row("failedToScore")[1]}
            away={row("failedToScore")[2]}
          />
        </tbody>
      </table>
      {d.sample > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs uppercase tracking-wider text-muted-foreground">
            Escanteios, faltas e cartões — média dos últimos {d.sample} jogos
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 text-left font-medium">Métrica</th>
                <th className="py-1 text-right font-medium">Geral</th>
                <th className="py-1 text-right font-medium">Casa</th>
                <th className="py-1 text-right font-medium">Fora</th>
              </tr>
            </thead>
            <tbody>
              <SplitRow
                label="Escanteios a favor/j"
                all={d.cornersAvg}
                home={dh.cornersAvg}
                away={da.cornersAvg}
              />
              <SplitRow
                label="Escanteios contra/j"
                all={d.cornersAgainstAvg}
                home={dh.cornersAgainstAvg}
                away={da.cornersAgainstAvg}
              />
              <SplitRow
                label="Escanteios no jogo/j"
                all={d.cornersTotalAvg}
                home={dh.cornersTotalAvg}
                away={da.cornersTotalAvg}
              />
              <SplitRow
                label="Jogos com +8.5 escanteios"
                all={`${d.over85Corners}%`}
                home={`${dh.over85Corners}%`}
                away={`${da.over85Corners}%`}
              />
              <SplitRow
                label="Faltas cometidas/j"
                all={d.foulsAvg}
                home={dh.foulsAvg}
                away={da.foulsAvg}
              />
              <SplitRow
                label="Cartões amarelos/j"
                all={d.yellowsAvg}
                home={dh.yellowsAvg}
                away={da.yellowsAvg}
              />
              <SplitRow
                label="Cartões vermelhos/j"
                all={d.redsAvg}
                home={dh.redsAvg}
                away={da.redsAvg}
              />
              <SplitRow
                label="Cartões no total/j"
                all={d.cardsAvg}
                home={dh.cardsAvg}
                away={da.cardsAvg}
              />
              <SplitRow
                label="Finalizações/j"
                all={d.shotsAvg}
                home={dh.shotsAvg}
                away={da.shotsAvg}
              />
              <SplitRow
                label="Chutes no gol/j"
                all={d.shotsOnTargetAvg}
                home={dh.shotsOnTargetAvg}
                away={da.shotsOnTargetAvg}
              />
              <SplitRow
                label="Posse de bola"
                all={`${d.possessionAvg}%`}
                home={`${dh.possessionAvg}%`}
                away={`${da.possessionAvg}%`}
              />
              <SplitRow
                label="Impedimentos/j"
                all={d.offsidesAvg}
                home={dh.offsidesAvg}
                away={da.offsidesAvg}
              />
              <SplitRow
                label="Defesas do goleiro/j"
                all={d.savesAvg}
                home={dh.savesAvg}
                away={da.savesAvg}
              />
            </tbody>
          </table>
        </>
      )}
      <p className="mb-2 mt-4 text-xs uppercase tracking-wider text-muted-foreground">Padrões</p>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum padrão forte.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {patterns.map((pt) => (
            <li key={pt.label}>
              <div className="flex justify-between gap-2">
                <span>{pt.label}</span>
                <span className="tabular text-xs font-bold text-primary">
                  {pt.hits}/{pt.total}
                </span>
              </div>
              <Bar value={pt.pct} tone={pt.strength === "forte" ? "primary" : "accent"} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- AI match analysis ---------- */

export function AiMatchAnalysis({ buildContext }: { buildContext: () => Promise<string> }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);
  const run = async () => {
    if (!user) {
      toast("Entre na sua conta para usar a análise com IA");
      return;
    }
    setRunning(true);
    setText("");
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const { data: s } = await supabase.auth.getSession();
      const context = await buildContext();
      const res = await fetch("/api/ai-ticket", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ mode: "match", context: context.slice(0, 15900) }),
      });
      if (!res.ok || !res.body) {
        toast.error(await res.text());
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((a) => a + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("A análise falhou. Tente novamente.");
    } finally {
      setRunning(false);
    }
  };
  return (
    <Section
      title="Análise da IA"
      right={
        running ? (
          <button
            onClick={() => ctrlRef.current?.abort()}
            className="rounded-md border px-3 py-1 text-xs"
          >
            Parar
          </button>
        ) : (
          <button
            onClick={run}
            className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            {text ? "Analisar de novo" : "Analisar partida"}
          </button>
        )
      }
    >
      {text ? (
        <div className="space-y-2 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_h2]:text-primary [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-foreground">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {running
            ? "Analisando estatísticas…"
            : "A IA cruza forma, casa/fora, padrões, confronto direto, modelo e odds para apontar mercados com valor."}
        </p>
      )}
    </Section>
  );
}

/* ---------- Live alerts ---------- */

export function useLiveAlerts(m: MatchSummary | undefined) {
  const [on, setOn] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const lastState = useRef<string | null>(null);
  useEffect(() => {
    setOn(localStorage.getItem("alerts:" + (m?.id ?? "")) === "1");
  }, [m?.id]);
  useEffect(() => {
    if (!m) return;
    const keys = m.events.map((e) => `${e.minute}|${e.type}|${e.player}|${e.teamId}`);
    if (seen.current === null) {
      seen.current = new Set(keys);
      lastState.current = m.state;
      return;
    }
    if (!on) {
      keys.forEach((k) => seen.current!.add(k));
      lastState.current = m.state;
      return;
    }
    const notify = (title: string, body: string) => {
      toast(title, { description: body, duration: 8000 });
      if (typeof Notification !== "undefined" && Notification.permission === "granted")
        new Notification(title, { body });
    };
    m.events.forEach((e, i) => {
      const k = keys[i]!;
      if (seen.current!.has(k)) return;
      seen.current!.add(k);
      const team =
        e.teamId === m.home.id ? m.home.short : e.teamId === m.away.id ? m.away.short : "";
      const what = e.goal
        ? "⚽ GOL"
        : e.red
          ? "🟥 Cartão vermelho"
          : e.yellow
            ? "🟨 Cartão amarelo"
            : e.type;
      notify(
        `${what} ${team} ${e.minute}`,
        `${e.player ?? ""} · ${m.home.short} ${m.home.score ?? 0} x ${m.away.score ?? 0} ${m.away.short}`,
      );
    });
    if (lastState.current !== m.state) {
      if (m.state === "in") notify("Começou!", `${m.home.short} x ${m.away.short}`);
      if (m.state === "post")
        notify("Fim de jogo", `${m.home.short} ${m.home.score} x ${m.away.score} ${m.away.short}`);
      lastState.current = m.state;
    }
  }, [m, on]);
  const toggle = async () => {
    const next = !on;
    if (next && typeof Notification !== "undefined" && Notification.permission === "default")
      await Notification.requestPermission();
    localStorage.setItem("alerts:" + (m?.id ?? ""), next ? "1" : "0");
    setOn(next);
    toast(next ? "Alertas ativados: gols, cartões, início e fim" : "Alertas desativados");
  };
  return { on, toggle };
}

export function AlertButton({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs",
        on ? "border-primary text-primary" : "text-muted-foreground",
      )}
    >
      {on ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {on ? "Alertas ligados" : "Receber alertas"}
    </button>
  );
}
