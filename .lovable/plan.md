
# EscalaPro OS — Build Plan

Sistema operacional de escala de turnos (pt-BR), mobile-first (390px), com backend Lovable Cloud e OCR de escalas em papel via IA.

## Design

Direção escolhida: **Dispatcher command** (fundo `#f8f8f8`, primary laranja `#ea580c`, foreground `#09090b`, fontes Inter + JetBrains Mono para números/horários, cantos arredondados suaves, KPIs com borda lateral colorida, bottom sheet com slide-up animation).

Tokens vão para `src/styles.css` no formato oklch; layout, densidade, hierarquia e microcopy seguem o protótipo fielmente.

## Escopo funcional

1. **Feed Diário** — setor selector (chips), toggle Feed/Planilha, KPIs (Ativos/Faltas/Extras), cards de colaborador com bloco de horário mono, ações Falta/Ajustar, botão flutuante "+ Freelancer".
2. **Planilha Semanal** — matriz colaboradores × 7 dias, scroll horizontal, primeira coluna fixa, células com bloco de turno colorido.
3. **Escanear Escala (Vision Engine)** — upload de foto → OCR com Lovable AI (Gemini vision) → extrai colaboradores + turnos → tela de revisão → grava em massa na semana.
4. **Injetar Freelancer** — bottom sheet com chips Manhã/Tarde/Noite/Personalizado, escolha de setor, confirmar cria shift `is_freelancer=true` no dia.
5. **Configurações** — CRUD de setores; cadastro de funcionários CLT (nome, perfil regulador CLTRegular/Estagiario/CLTMulher, entrada, jornada, setor).
6. **Registrar Falta / Ajustar Bloco** — modais para marcar ausência do dia e editar horário de um turno.
7. **Log de alterações** — lista simples de eventos recentes.

Autenticação por email/senha (Cloud). Cada workspace = 1 usuário owner por enquanto (multi-tenant fica para depois).

## Backend (Lovable Cloud)

Schema:
- `profiles(id, email, display_name)`
- `sectors(id, owner_id, name, created_at)`
- `employees(id, owner_id, sector_id, name, role_profile enum, entry_time, journey_hours, created_at)` — `role_profile` = `clt_regular | estagiario | clt_mulher`
- `shifts(id, owner_id, employee_id nullable, sector_id, shift_date, start_time, end_time, is_freelancer, is_extra, status enum(scheduled|absent|completed))`
- `absences(id, owner_id, employee_id, absence_date, reason)`
- `activity_log(id, owner_id, event_type, payload jsonb, created_at)`

RLS em todas: `owner_id = auth.uid()`. GRANTs para `authenticated` + `service_role`. Estrutura `_authenticated/` para rotas protegidas.

Server functions (`src/lib/*.functions.ts`):
- `sectors.functions.ts` — list/create/delete
- `employees.functions.ts` — list/create/update/delete
- `shifts.functions.ts` — listByDay(sector, date), listByWeek(weekStart), createFreelancer, updateBlock, markAbsent
- `activity.functions.ts` — list recent
- `scan.functions.ts` — `scanSchedule({ imageBase64, mimeType })` → chama Lovable AI Gateway (google/gemini-3.1-flash-image ou modelo de visão chat) com prompt estruturado + `Output.object` retornando `{ employees: [{ name, days: [{ date, start, end }] }] }`. Retorna rascunho para o cliente revisar antes de gravar.
- `scan.functions.ts::applyScan` — grava shifts em batch após revisão.

Todas com `.middleware([requireSupabaseAuth])`.

## Rotas

- `/auth` — login/signup (público)
- `/_authenticated/route.tsx` — gate integrado
- `/_authenticated/index.tsx` — redireciona para `/feed`
- `/_authenticated/feed.tsx` — Feed Diário
- `/_authenticated/semana.tsx` — Planilha Semanal
- `/_authenticated/escanear.tsx` — Vision Engine (upload + revisão)
- `/_authenticated/configuracoes.tsx` — Setores + Funcionários
- `/_authenticated/atividade.tsx` — Log

Rota `/` continua sendo o entry — vou reescrevê-la para redirecionar para `/feed` (autenticado) ou `/auth`.

## Arquivos-chave

- `src/styles.css` — tokens Dispatcher (background/foreground/primary/border, JetBrains Mono via `<link>` no `__root.tsx`)
- `src/routes/__root.tsx` — atualizar meta (title "EscalaPro OS", description pt-BR), links de fontes, remover placeholder
- `src/routes/index.tsx` — reescrever como redirect
- `src/components/`:
  - `SectorChips.tsx`, `ViewToggle.tsx`, `KpiTrio.tsx`
  - `EmployeeShiftCard.tsx`, `WeeklyMatrix.tsx`
  - `FreelancerSheet.tsx`, `AbsenceSheet.tsx`, `AdjustBlockSheet.tsx`
  - `SectorForm.tsx`, `EmployeeForm.tsx`
  - `ScanUploader.tsx`, `ScanReview.tsx`
- Server functions em `src/lib/`
- Migração inicial (`GRANT` + RLS + policies)

## OCR (Vision Engine)

Modelo: `google/gemini-3.5-flash` (chat + vision, mais recente e barato para OCR).
Fluxo: usuário tira foto → `<img>` convertida para base64 no cliente → `useServerFn(scanSchedule)({ data: { imageBase64, mimeType, weekStart } })` → handler monta mensagem com `image_url` (data URL), `Output.object` com schema Zod estrito de `{ employees: [...] }` → devolve rascunho → tela de revisão permite ajustar nomes/horários e mapear para funcionários existentes → `applyScan` grava.

Tratamento: 429 → toast pedindo retry; 402 → toast pedindo créditos.

## Notas técnicas

- `LOVABLE_API_KEY` já vem via Cloud (verifico via `ai_gateway--create`).
- `attachSupabaseAuth` middleware registrado em `src/start.ts` para bearer nas server functions.
- Todos os textos de UI em pt-BR.
- Sem service worker, sem PWA, sem multi-tenant além do owner_id nesta versão.
- Log de atividade gravado a cada mutação (via helper server-side).

## Fora do escopo desta iteração

- Multi-usuário por workspace / convites
- Notificações push
- Cálculo automático de horas extras / regras CLT complexas (o `role_profile` só marca, não valida ainda)
- Exportação PDF
