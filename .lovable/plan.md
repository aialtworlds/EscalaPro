## O problema

Hoje `src/lib/clt-rules.ts` tem os limites cravados no código (44h, 11h, 6h estagiário, 2h extras). Isso funciona como demonstração, mas quebra na vida real porque:

- **CCT/ACT sobrepõem a CLT** em jornada, intervalo, adicional noturno e banco de horas. Cada sindicato/categoria/base territorial tem números diferentes.
- **Escalas especiais** (12x36, 6x1, 5x2, 24x72, escala espanhola) mudam a própria lógica: 12x36 é legal mesmo estourando 8h/dia, mas exige acordo e 36h de descanso.
- **Município/Estado** entram sobretudo em feriados locais e leis de funcionamento (comércio aos domingos), não em jornada.
- Regra errada exibida com cara de autoridade é pior que nenhuma regra: gera decisão jurídica equivocada.

## Estratégia: motor de regras dirigido por dados, não por código

Três camadas, da mais genérica à mais específica, aplicadas em cascata — a mais específica vence:

```text
  BASE FEDERAL (CLT)         imutável, versionada, embarcada no app
        ↓ sobrescreve
  CONVENÇÃO (CCT/ACT)        por categoria + base territorial + vigência
        ↓ sobrescreve
  ACORDO INDIVIDUAL/ESCALA   12x36, banco de horas, compensação
```

Cada colaborador aponta para um **perfil de jornada** (regime + convenção). O motor resolve os parâmetros efetivos antes de avaliar e sempre diz **de onde veio cada número**.

### Parâmetros que saem do código e viram dados

Jornada diária e semanal, teto de horas extras, intervalo intrajornada (duração e faixa de disparo), interjornada, descanso semanal, regime de escala (5x2 / 6x1 / 12x36 / 24x72), janela noturna e hora reduzida, dias de feriado aplicáveis.

### Regime de escala como estratégia própria

O regime deixa de ser detalhe e passa a escolher qual conjunto de checagens roda:

- **Padrão (5x2 / 6x1)**: regras atuais.
- **12x36**: jornada de 12h é esperada; valida 36h de descanso subsequente, exige flag de acordo escrito, não acusa hora extra por passar de 8h.
- **Estágio**: 6h/dia, 30h/semana, veto a noturno, 4h em dia de prova.
- **Jornada parcial / intermitente**: tetos próprios.

## Segurança: como errar menos

1. **Severidade honesta.** Três níveis com significado jurídico distinto: `bloqueio` (violação de norma federal cogente — nunca sobrescrevível), `atenção` (depende de acordo/convenção — pode ser liberado com justificativa registrada), `informativo` (boa prática).
2. **Citação obrigatória.** Toda violação carrega base legal (`CLT art. 66`, `CCT SINDICATO X 2025/2026 cláusula 12`) e a fonte do parâmetro. Sem fonte, a regra não é exibida como violação.
3. **Aviso de escopo.** Rodapé permanente no painel CLT: verificação automatizada de apoio, não substitui parecer jurídico nem a convenção vigente. Isso protege você e o usuário.
4. **Override auditado.** Quando o gestor libera um `atenção`, grava-se quem, quando e por quê em `activity_log`. Vira prova de diligência.
5. **Vigência.** Convenção tem data de início e fim; ao vencer, o app avisa em vez de continuar validando com números velhos.
6. **Testes como rede.** Suíte de casos por regime (12x36 legal, 12x36 sem descanso, 6x1 com 7º dia, estagiário noturno, semana de 44h exata, virada de meia-noite) rodando a cada mudança no motor. É o que impede regressão silenciosa.

## Eficiência

- Motor puro, sem I/O, roda igual no cliente (feedback instantâneo ao editar turno) e no servidor (filtro de candidatos à cobertura). Já é assim — preservar.
- Avaliação por colaborador/semana, com os turnos da semana carregados uma vez e reaproveitados (o feed já faz isso).
- Parâmetros resolvidos uma vez por avaliação, não por regra.

## Como a convenção entra no app (sem virar trabalho de digitação)

Faseado:

- **Fase 1** — base federal versionada + regimes de escala + campo de perfil de jornada por colaborador. Cobre a maior parte dos casos e já elimina os falsos positivos de 12x36.
- **Fase 2** — cadastro manual de convenção em Configurações: formulário curto com os parâmetros que mais variam, com vigência. Gestor preenche uma vez.
- **Fase 3** — importar a CCT em PDF e deixar a IA (mesmo gateway do scan de escala) extrair os parâmetros, apresentando cada valor para confirmação humana antes de salvar. Nada entra no motor sem o gestor confirmar.

Feriados: tabela nacional embarcada + cadastro de feriados estaduais/municipais por operação (poucas linhas por ano).

## Detalhes técnicos

**Banco**
- `compliance_profiles` — regime, referência à convenção, parâmetros efetivos.
- `agreements` — convenção/acordo: nome, sindicato, base territorial, vigência, parâmetros em `jsonb`, origem (manual/IA) e status de confirmação.
- `holidays` — data, âmbito (nacional/estadual/municipal), UF/município.
- `compliance_overrides` — turno, código da regra, justificativa, autor, timestamp.
- `employees` ganha `compliance_profile_id`.
- RLS por `owner_id` em todas, com GRANT explícito.

**Código**
- `src/lib/clt/params.ts` — tipo `ComplianceParams` + defaults federais versionados (`FEDERAL_2026`).
- `src/lib/clt/resolve.ts` — cascata federal → convenção → perfil, devolvendo valor + procedência.
- `src/lib/clt/regimes/*.ts` — uma estratégia por regime, exportando as checagens aplicáveis.
- `src/lib/clt-rules.ts` — vira orquestrador: resolve parâmetros, escolhe regime, roda checagens, devolve `Violation[]` agora com `basis` e `source`.
- `src/lib/clt/__tests__/` — suíte por regime.
- `Violation` ganha `basis: string` e `source: "federal" | "convencao" | "acordo"`; `CltBadge`/`CltPanel` exibem a citação; `CoverageSheet` só bloqueia em `error` de origem federal.

**Compatibilidade**: colaborador sem perfil cai no padrão federal atual — nada quebra durante a migração.
