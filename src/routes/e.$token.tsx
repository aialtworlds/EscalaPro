import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedWeek } from "@/lib/share.functions";
import { addDays, WEEKDAY_LABELS, trimTime } from "@/lib/date-utils";

export const Route = createFileRoute("/e/$token")({
  head: () => ({
    meta: [
      { title: "Escala da semana — EscalaPro OS" },
      { name: "description", content: "Escala operacional da semana, somente leitura." },
      { property: "og:title", content: "Escala da semana — EscalaPro OS" },
      { property: "og:description", content: "Escala operacional da semana, somente leitura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedWeekPage,
});

function SharedWeekPage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getSharedWeek);
  const q = useQuery({ queryKey: ["shared-week", token], queryFn: () => fn({ data: { token } }) });

  if (q.isLoading) {
    return <Centered>Carregando escala…</Centered>;
  }
  if (!q.data?.ok) {
    return (
      <Centered>
        {q.data?.reason === "expired" ? "Este link expirou." : "Link inválido ou revogado."}
      </Centered>
    );
  }

  const { week_start: weekStart, shifts } = q.data;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const label = `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)} — ${days[6].slice(8, 10)}/${days[6].slice(5, 7)}`;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="px-4 pt-8 pb-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">EscalaPro</p>
        <h1 className="text-2xl font-bold font-mono mt-1">{label}</h1>
        <p className="text-xs text-muted-foreground mt-1">Escala publicada • somente leitura</p>
      </header>

      <div className="px-4 py-4 space-y-5 max-w-xl mx-auto">
        {days.map((d, i) => {
          const rows = shifts.filter((s) => s.shift_date === d);
          return (
            <section key={d}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                {WEEKDAY_LABELS[(i + 1) % 7]} {d.slice(8, 10)}/{d.slice(5, 7)}
              </h2>
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem turnos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map((s, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${s.status === "absent" ? "line-through text-muted-foreground" : ""}`}>
                          {s.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {s.sector ?? "Sem setor"}
                          {s.is_freelancer ? " • Freelancer" : ""}
                          {s.is_extra ? " • Extra" : ""}
                          {s.status === "absent" ? " • Falta" : ""}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold text-primary shrink-0 ml-3">
                        {trimTime(s.start_time)}–{trimTime(s.end_time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid place-items-center bg-background text-foreground p-6">
      <p className="text-sm text-muted-foreground text-center">{children}</p>
    </main>
  );
}
