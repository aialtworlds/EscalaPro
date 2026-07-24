import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSectors from "./tools/list-sectors";
import listEmployees from "./tools/list-employees";
import listShiftsByDay from "./tools/list-shifts-by-day";
import listShiftsByWeek from "./tools/list-shifts-by-week";
import createShift from "./tools/create-shift";
import markShiftAbsent from "./tools/mark-shift-absent";
import recentActivity from "./tools/recent-activity";

// The OAuth issuer must be the direct Supabase host (see mcp-js discovery/RFC 8414).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "escalapro-os",
  title: "EscalaPro OS",
  version: "0.1.0",
  instructions:
    "Ferramentas operacionais do EscalaPro: gestão de setores, funcionários, escala diária e semanal, criação de turnos, registro de faltas e histórico de atividades. Todas as chamadas atuam como o usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSectors,
    listEmployees,
    listShiftsByDay,
    listShiftsByWeek,
    createShift,
    markShiftAbsent,
    recentActivity,
  ],
});
