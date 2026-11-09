import { useMemo, useState } from "react";
import type { PitchEvent } from "@/lib/espn.functions";
import { cn } from "@/lib/utils";

/** Campo horizontal 105x68. x=0..100 (comprimento), y=0..100 (largura). */
export function Pitch({ children, className }: { children?: React.ReactNode; className?: string }) {
  const line = "var(--muted-foreground)";
  return (
    <svg
      viewBox="0 0 105 68"
      className={cn("w-full rounded-lg bg-muted/40", className)}
      role="img"
      aria-label="Campo de futebol"
    >
      <g fill="none" stroke={line} strokeWidth="0.35" opacity="0.7">
        <rect x="0.5" y="0.5" width="104" height="67" />
        <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" />
        <circle cx="52.5" cy="34" r="9.15" />
        <rect x="0.5" y="13.85" width="16.5" height="40.3" />
        <rect x="88" y="13.85" width="16.5" height="40.3" />
        <rect x="0.5" y="24.85" width="5.5" height="18.3" />
        <rect x="99" y="24.85" width="5.5" height="18.3" />
      </g>
      {children}
    </svg>
  );
}

const COLORS: Record<PitchEvent["outcome"], string> = {
  goal: "var(--primary)",
  on_target: "#38bdf8",
  blocked: "#a78bfa",
  off_target: "#94a3b8",
  other: "#94a3b8",
};
const LABELS: Record<PitchEvent["outcome"], string> = {
  goal: "Gol",
  on_target: "No alvo",
  blocked: "Bloqueado",
  off_target: "Fora",
  other: "Outro",
};

export function ShotMap({
  events,
  home,
  away,
}: {
  events: PitchEvent[];
  home: { id: string; name: string };
  away: { id: string; name: string };
}) {
  const [team, setTeam] = useState<string>("all");
  const shots = useMemo(
    () => events.filter((e) => e.kind !== "other" && (team === "all" || e.teamId === team)),
    [events, team],
  );
  // Mandante ataca para a direita; visitante para a esquerda (espelha o x do visitante se os dados vierem na mesma direção).
  const place = (e: PitchEvent) => {
    const x = e.teamId === away.id ? 100 - e.x : e.x;
    return { cx: (x / 100) * 105, cy: (e.y / 100) * 68 };
  };
  if (!events.length)
    return (
      <p className="text-sm text-muted-foreground">
        A fonte atual (ESPN) não enviou coordenadas de lances para esta partida. Ao conectar um
        provedor de eventos (Opta, Wyscout, SportRadar), os mapas aparecem aqui sem mudar a tela.
      </p>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(
          [
            ["all", "Ambos"],
            [home.id, home.name],
            [away.id, away.name],
          ] as [string, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTeam(id)}
            className={cn(
              "rounded-md border px-3 py-1",
              team === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto flex gap-3">
          {(Object.keys(LABELS) as PitchEvent["outcome"][])
            .filter((k) => k !== "other")
            .map((k) => (
              <span key={k} className="flex items-center gap-1">
                <i
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: COLORS[k] }}
                />
                {LABELS[k]}
              </span>
            ))}
        </span>
      </div>
      <Pitch>
        {shots.map((e) => {
          const p = place(e);
          return (
            <circle
              key={e.id}
              {...p}
              r={e.kind === "goal" ? 1.8 : 1.2}
              fill={COLORS[e.outcome]}
              fillOpacity="0.85"
              stroke="white"
              strokeWidth="0.25"
            >
              <title>{`${e.minute} ${e.player ?? ""} — ${e.type}`}</title>
            </circle>
          );
        })}
      </Pitch>
      <p className="text-xs text-muted-foreground">{shots.length} finalizações com coordenadas.</p>
    </div>
  );
}
