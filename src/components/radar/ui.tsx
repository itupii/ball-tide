import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useSlip, type Selection } from "@/lib/slip";
import { useAuth } from "@/lib/auth";
import { Activity, LineChart, Ticket, User } from "lucide-react";

export function TeamLogo({ src, alt, size = 24 }: { src: string | null; alt: string; size?: number }) {
  if (!src)
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-display text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
      >
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

export function FormPill({ r }: { r: "W" | "D" | "L" }) {
  const map = { W: ["V", "bg-win text-primary-foreground"], D: ["E", "bg-draw text-primary-foreground"], L: ["D", "bg-loss text-destructive-foreground"] } as const;
  return <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold", map[r][1])}>{map[r][0]}</span>;
}

export function LiveBadge({ text }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-live/15 px-1.5 py-0.5 text-[11px] font-semibold text-live">
      <span className="live-dot" /> {text || "AO VIVO"}
    </span>
  );
}

export function Bar({ value, tone = "primary" }: { value: number; tone?: "primary" | "accent" | "muted" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", tone === "primary" ? "bg-primary" : tone === "accent" ? "bg-accent" : "bg-muted-foreground")}
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
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary hover:border-primary/60",
      )}
    >
      <span className={cn("text-[10px] uppercase tracking-wide", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</span>
      <span className="tabular text-sm font-semibold">{sel.odds.toFixed(2)}</span>
      {sub && <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</span>}
    </button>
  );
}

export function Section({ title, children, right, className }: { title: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
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
    { to: "/odds", label: "Odds", icon: LineChart },
    { to: "/bilhete", label: "Bilhete", icon: Ticket },
  ] as const;
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">R</span>
          <span className="font-display text-xl font-bold uppercase tracking-wider">Radar<span className="text-primary">FC</span></span>
        </Link>
        <nav className="ml-2 flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
            >
              <n.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{n.label}</span>
              {n.to === "/bilhete" && items.length > 0 && (
                <span className="tabular grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{items.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <Link to="/auth" className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:border-primary/60">
            <User className="h-4 w-4" />
            <span className="hidden max-w-[10rem] truncate sm:inline">{user ? user.email : "Entrar"}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
