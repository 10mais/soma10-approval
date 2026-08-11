# MULTITENANT-PLANO.md — Caminho A → B (um deploy, um banco, N organizações)

> Plano de execução para transformar o Soma10 em multi-tenant. Escrito em 2026-08-11.
> **Não começar sem uma janela calma de 2 semanas sem features em paralelo.**
> Números do repo nesta data: **140 rotas de API · 106 libs · 7 crons · 3 webhooks ·
> ~60 famílias de chave no Redis · 755 testes verdes**.

## STATUS

- **F0 EM ANDAMENTO — branch `multitenant-f0`** (2026-08-11): `lib/orgPrefix.ts`
  (núcleo puro) + `lib/dbOrg.ts` (wrapper) + `lib/orgs.ts` (registro/resolução
  por host) + testes de unidade e a trava estática (`tests/isolamentoOrg.test.ts`)
  + rota piloto migrada (`/api/agentes`) + inventário gerado
  (`MULTITENANT-CHECKLIST.md`, 125 arquivos / 695 chamadas, via
  `node scripts/mapear-chaves.mjs`). **Dono valida o padrão no diff/preview do
  branch antes de qualquer merge.**
- Refinamentos sobre o plano original: (a) o registro da org grava em
  **`org-reg:{id}`** (não `org:{id}`) para nunca ambiguar com chaves de DADO
  `org:{id}:...`; (b) **modo legado**: com nenhuma org registrada, o wrapper não
  prefixa nada — rotas migradas podem ir à MAIN aos poucos com comportamento
  idêntico nas instâncias atuais, e o "corte" final vira apenas registrar orgs e
  hosts (mata o big-bang das fases F1-F3); (c) o checklist §3 é GERADO do código
  e encolhe sozinho: arquivo migrado deixa de usar `redis.` e sai do inventário.

## 0. Estado atual e objetivo

Hoje (Caminho A): **uma instância por cliente** — mesmo repo, mas cada cliente tem
projeto Vercel + Upstash + Blob próprios. Isolamento é físico (bancos separados);
por isso nenhuma chave carrega organização (`post:{id}`, set global `posts`…).

Objetivo (Caminho B): **um deploy e um banco**, com N organizações dentro.
Cada org mantém seu subdomínio (`norah.soma10.com.br` → org `norah`). O "perfil de
instância" (clinica/turismo/cidadania/telefonia/agência) vira **atributo da org**.

A migração A→B é limpa **porque** hoje 1 banco = 1 org: importar cada Upstash
inteiro sob o prefixo da org não exige separar dados misturados.

## 1. Decisões de arquitetura (fechar ANTES de codar)

1. **Isolamento por PREFIXO DE CHAVE, não por filtro.** Toda chave vira
   `org:{orgId}:<chave-atual>` (ex.: `org:norah:post:{id}`, set `org:norah:posts`).
   - Por quê: filtro (`.filter(x => x.orgId === ...)`) exige acertar em 140 rotas —
     UM esquecimento vaza dados entre empresas. Prefixo torna o isolamento
     **estrutural**: quem usa o wrapper (item 2) não CONSEGUE ler de outra org.
2. **Wrapper obrigatório `dbOrg(orgId)`** (lib nova `lib/dbOrg.ts`): expõe a mesma
   API do cliente Redis (`get/set/sadd/smembers/mget/lrange/zadd/del/incr/decrby...`),
   prefixando TODA chave. `redis` cru fica **proibido** fora de `lib/dbOrg.ts`,
   `lib/orgs.ts` e `/api/admin/*` — com **teste estático** que falha o build se
   alguém importar direto (a trava de verdade; ver §5.1).
3. **Resolução da org por HOST** no início da request: `lib/orgs.ts` mantém
   `orgs:hosts` (mapa host→orgId, cacheado). Rota pública e página resolvem org
   pelo `Host`; sessão NextAuth carrega `orgId` (redundância que permite conferir:
   host ≠ org da sessão → 401).
4. **Login por org:** e-mail é único DENTRO da org (`org:{id}:usuario:{email}`).
   O mesmo e-mail pode existir em duas orgs — o host decide qual banco de usuários
   o login consulta. (Hoje já é assim entre instâncias.)
5. **Integrações saem das envs e viram dado da org** (criptografado):
   `org:{id}:config:integracoes` = { EVOLUTION_URL/KEY/INSTANCE, ANTHROPIC_API_KEY,
   INSTAGRAM_APP_*, SMTP, BLOB token, STRIPE keys, GOOGLE_PLACES… }.
   Cripto: AES-GCM com `SECRETS_KEY` (env única do deploy central).
   Libs (`whatsapp.ts`, `publicar.ts`, cliente Anthropic, nodemailer) passam a
   receber a config da org em vez de ler `process.env`.
6. **Blob:** um store único; **prefixo de pasta por org** no pathname
   (`{orgId}/uploads/...`) via `putBlobAdaptativo`. Migrar mídia antiga é opcional
   (URLs antigas continuam válidas); só uploads novos ganham o prefixo.
7. **Tokens públicos ganham org no VALOR, não na URL:** `aprovtoken:{token}` →
   `{ orgId, clienteId }` (hoje é só clienteId). Links já enviados continuam
   funcionando após migração (o script regrava o valor). Vale para `aprovtoken`,
   `statusToken`, `npstoken`, código de post.

## 2. Fases (ordem de execução)

**F0 — Fundações (1–2 dias).** `lib/orgs.ts` (tipo Org, hosts, cache, CRUD admin)
+ `lib/dbOrg.ts` (wrapper) + testes de unidade do wrapper + teste estático da
proibição de `redis` cru + NextAuth com `orgId` na sessão + `orgDaRequest()`
(host→org, com conferência contra a sessão). Nada de rota migrada ainda.

**F1 — Auth e usuários (1 dia).** `usuario:`/set `usuarios`/2FA/push/notif-prefs/
chat interno para o wrapper. Login/registro/reset consultam a org do host.
É a fase-piloto: valida o padrão de migração de rota.

**F2 — Núcleo de produção (2–3 dias).** `cliente:` (+arquivado), `post:`, `plano:`,
`tarefa:`, `marco:`, sets e lixeiras, `postsIndex`, `agendados`, esteira
(gerar-plano/copy/aprovar, tarefasDaPauta, esteiraFluxo), decision, aprovacao-link,
status, logs-cliente, notificações. Tokens públicos passam a `{orgId, clienteId}`.

**F3 — Demais domínios (2 dias).** CRM inteiro (contatos, empresas, negócios,
pipelines/estágios, playbook, mensagens `wa:*`/`ig:*`), agenda/clinica
(agendamentos, bloqueios, esperas, procedimentos), turismo (viagens, veículos,
reservas, **travas `SET NX` de assento — prefixar!**, lançamentos), telefonia
(produtos, estoque, lojas, vendas, movestoque), cidadania (processos), financeiro
(despesas, lançamentos), documentos/mapas/reuniões/briefings/candidaturas/
templates/agentes/nps/auditoria.

**F4 — Config e integrações por org (2 dias).** `config:*` por org (agencia,
perfilInstancia, permissões, automações, módulos, segurança). §1.5: cofre de
integrações + refactor das libs que leem `process.env`. Tela admin "Integrações"
passa a gravar no cofre da org.

**F5 — Webhooks e crons (1–2 dias).**
- Webhooks ganham a org na URL: `/api/whatsapp/webhook/{orgSlug}`,
  `/api/instagram/webhook/{orgSlug}`, `/api/stripe/webhook/{orgSlug}` (registrar a
  URL nova no Evolution/Meta/Stripe de cada org durante o corte; a rota antiga
  continua aceitando o formato velho enquanto houver instância A viva).
- Crons viram **loop por org**: `for (const org of listarOrgs()) { ... dbOrg(org.id) }`.
  cron-job.org continua chamando 1 URL. Atenção ao `maxDuration` (300s) — se o
  loop crescer, paralelizar por org com `Promise.allSettled` e continuar no
  próximo tick o que não coube.

**F6 — Migração e corte (1–2 dias + 1 janela por cliente).**
- Script `scripts/migrar-org.mjs`: lê o Upstash da instância (mesma técnica do
  `lib/backup.ts` — SCAN por família de chave), regrava tudo no banco central sob
  `org:{id}:` e regrava tokens públicos com `{orgId, clienteId}`. `--dry` primeiro
  (contagem por família, zero escrita).
- Corte POR CLIENTE, um por vez, fora do horário: congela escrita (aviso),
  roda o script, aponta o CNAME do subdomínio para o projeto central, smoke test
  (§5.4), instância antiga fica de pé **read-only por 1 semana** como fallback.
- Ordem sugerida: 1 org piloto pequena → Norah → Deny → Sua Dupla → Missões →
  agência por último (é a maior).

**F7 — Onboarding e billing (não bloqueia o corte).** Tela de criar org
(provisiona prefixo, admin inicial, perfil) + Stripe por org + página de planos.
Substitui o runbook INSTANCIAS.md (~30 min → ~2 min).

## 3. Ordem de migração das rotas (dentro de cada fase)

Padrão por rota: (1) trocar `redis` → `dbOrg(await orgDaRequest(req))`;
(2) rodar o teste estático (acusa o que faltou); (3) teste de duas-orgs da família
(§5.3). Começar sempre pela rota de LEITURA da família (lista), depois escrita.
A tabela completa rota→família sai de um script (`scripts/mapear-chaves.mjs`,
grep de `redis.` por arquivo) — gerar na F0 e usar como checklist vivo.

## 4. O que NÃO muda

- UI/componentes (eles já recebem dados das rotas; a autoridade é o servidor).
- Perfis de instância — viram `org.perfil`, semeados pelo mesmo catálogo.
- O repo, o fluxo de deploy (push na main) e os 755 testes existentes (libs puras
  não tocam Redis).
- Preço de infra: 1 Upstash maior ≈ soma dos pequenos (PAYG); Vercel: 1 projeto.

## 5. Estratégia de teste de isolamento (o coração do plano)

1. **Teste estático (vitest, roda no build):** varre `app/api/**` e `lib/**`;
   `import { redis }` fora da allowlist (`dbOrg.ts`, `orgs.ts`, `admin/*`,
   `backup.ts`) = teste vermelho = **deploy bloqueado** (o `build` já roda
   `vitest run` antes do `next build` — a trava é automática).
2. **Unidade do wrapper:** toda operação prefixa; chave já prefixada não duplica;
   `mget`/`pipeline` prefixam item a item; chave vazia lança.
3. **Teste de duas orgs por família:** sobe org A e B (Redis de teste/memória),
   grava entidade em A → TODAS as leituras em B voltam vazias (lista, get por id,
   índice, busca). Um teste por família de chave (~25 testes), gerados de uma
   tabela para não esquecer família nova.
4. **Smoke pós-corte (script):** loga em 2 orgs reais e compara as listagens
   principais (posts, clientes, tarefas, CRM, financeiro) — qualquer id de A
   aparecendo em B aborta o rollout.
5. **Regra permanente:** família de chave nova só nasce DENTRO do wrapper
   (o teste estático garante). `CLAUDE.md` ganha a regra quando o corte terminar.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Vazamento entre orgs (o risco central) | Prefixo estrutural + teste estático que bloqueia deploy + duas-orgs por família + smoke no corte |
| Links públicos antigos quebrarem | Tokens regravados com `{orgId, ...}` na migração; formato velho aceito até desligar a última instância A |
| Corrida na trava de assento (turismo) | `SET NX` continua atômico — só muda a chave (prefixada); teste dedicado na F3 |
| Cron estourar 300s com N orgs | Loop com `allSettled` + continuação; medir na F5 com as 5 orgs reais |
| Mesmo e-mail em 2 orgs | Login resolve pelo host; documentar que acesso cruzado exige contas separadas |
| Webhook chegando na org errada | Org na URL do webhook + validação do token/assinatura POR org |
| Migração no meio do expediente | Corte por cliente, fora de horário, com read-only de fallback por 1 semana |

## 7. Estimativa e critérios de início

- **10–14 dias úteis** de trabalho focado (F0–F6), sem features em paralelo.
  F7 (onboarding/billing) pode vir depois, sem pressa.
- Critério de "pode começar": nenhuma entrega de cliente com prazo nas 2 semanas
  seguintes; App Review da Meta resolvido (para não misturar troubleshooting).
- Critério de "terminou": todas as instâncias cortadas + instâncias antigas
  desligadas + teste estático ativo + INSTANCIAS.md marcado como legado.
