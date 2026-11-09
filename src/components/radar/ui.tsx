import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSlip, type Selection } from "@/lib/slip";
import { useAuth } from "@/lib/auth";
import { Activity, LineChart, Ticket, Trophy, User, Users } from "lucide-react";

export function TeamLogo({
  src,
  alt,
  size = 24,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  if (!src)
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-display text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
      >
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function FormPill({ r }: { r: "W" | "D" | "L" }) {
  const map = {
    W: ["V", "bg-win text-primary-foreground"],
    D: ["E", "bg-draw text-primary-foreground"],
    L: ["D", "bg-loss text-destructive-foreground"],
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold",
        map[r][1],
      )}
    >
      {map[r][0]}
    </span>
  );
}

export function LiveBadge({ text }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-live/15 px-1.5 py-0.5 text-[11px] font-semibold text-live">
      <span className="live-dot" /> {text || "AO VIVO"}
    </span>
  );
}

export function Bar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "accent" | "muted";
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "bar-grow h-full rounded-full",
          tone === "primary"
            ? "bg-primary"
            : tone === "accent"
              ? "bg-accent"
              : "bg-muted-foreground",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function OddButton({ sel, label, sub }: { sel: Selection; label: string; sub?: string }) {
  const { add, has, remove } = useSlip();
  const active = has(sel.id);
  return (
    <button
      onClick={() => (active ? remove(sel.id) : add(sel))}
      className={cn(
        "flex min-w-[4.5rem] flex-col items-center rounded-md border px-2 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary hover:border-primary/60",
      )}
    >
      <span
        className={cn(
          "text-[10px] uppercase tracking-wide",
          active ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="tabular text-sm font-semibold">{sel.odds.toFixed(2)}</span>
      {sub && (
        <span
          className={cn(
            "text-[10px]",
            active ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

export function Section({
  title,
  children,
  right,
  className,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card reveal rounded-xl p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function AppHeader() {
  const { items } = useSlip();
  const { user } = useAuth();
  const nav = [
    { to: "/", label: "Jogos", icon: Activity },
    { to: "/liga", label: "Liga", icon: Trophy },
    { to: "/jogadores", label: "Jogadores", icon: Users },
    { to: "/oportunidades", label: "Oportunidades", icon: LineChart },
    { to: "/bilhete", label: "Bilhete", icon: Ticket },
  ] as const;
  return (
    <header className="glass sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="RadarFC — início">
          <span className="pulse-ring grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)]">
            R
          </span>
          <span className="font-display text-xl font-bold uppercase tracking-wider">
            Radar<span className="text-primary">FC</span>
          </span>
        </Link>
        <nav className="ml-2 flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-px hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground data-[status=active]:shadow-[inset_0_-2px_0_var(--primary)]"
            >
              <n.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{n.label}</span>
              {n.to === "/bilhete" && items.length > 0 && (
                <span className="tabular grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {items.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <Link
            to="/auth"
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:border-primary/60"
          >
            <User className="h-4 w-4" />
            <span className="hidden max-w-[10rem] truncate sm:inline">
              {user ? user.email : "Entrar"}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------- componentes visuais v2 ---------- */

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Número que sobe animado até o valor (respeita prefers-reduced-motion). */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  duration = 900,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const [v, setV] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) {
      setV(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className="tabular">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Mini gráfico de linha com ponto final; decorativo (o valor já aparece em texto ao lado). */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const w = 80;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map(
    (d, i) =>
      [(i / (data.length - 1)) * w, h - 3 - ((d - min) / (max - min || 1)) * (h - 6)] as const,
  );
  const last = pts[pts.length - 1]!;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-6 w-20 overflow-visible", className)}
      aria-hidden="true"
    >
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--primary)" />
    </svg>
  );
}

/** Cartão de KPI com contagem animada. `index` define o atraso do efeito em cascata. */
export function StatCard({
  label,
  value,
  decimals = 0,
  suffix = "",
  hint,
  trend,
  index = 0,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
  trend?: number[];
  index?: number;
}) {
  return (
    <div
      className="surface-card hover-lift reveal rounded-xl p-4"
      style={{ ["--i" as string]: index }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="font-display text-3xl font-bold leading-none">
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        </div>
        {trend && <Sparkline data={trend} />}
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} aria-hidden="true" />;
}
