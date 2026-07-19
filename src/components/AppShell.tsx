import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, Settings, Home, CalendarDays, Activity } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[440px] mx-auto min-h-screen bg-background text-foreground antialiased pb-24">
      <TopBar />
      {children}
      <BottomNav />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
      <Link to="/feed" className="font-mono text-sm tracking-tighter font-bold uppercase">
        EscalaPro <span className="text-primary">OS</span>
      </Link>
      <div className="flex gap-2">
        <Link
          to="/escanear"
          className="size-9 rounded-lg border border-border flex items-center justify-center bg-card shadow-xs hover:bg-accent transition"
          aria-label="Escanear escala"
        >
          <Camera className="size-4" />
        </Link>
        <Link
          to="/configuracoes"
          className="size-9 rounded-lg border border-border flex items-center justify-center bg-card shadow-xs hover:bg-accent transition"
          aria-label="Configurações"
        >
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  );
}

function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/feed", label: "Feed", icon: Home },
    { to: "/semana", label: "Semana", icon: CalendarDays },
    { to: "/escanear", label: "Escanear", icon: Camera },
    { to: "/atividade", label: "Log", icon: Activity },
  ] as const;
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-background/95 backdrop-blur-md border-t border-border z-40">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active = path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-1 py-3 transition ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <it.icon className="size-5" strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
