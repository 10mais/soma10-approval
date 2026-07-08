# Soma10 Approval — Contexto técnico completo (handoff)

> Documento para retomar o projeto em outra janela/sessão sem perder informação.
> Mantido manualmente. Atualizar quando algo estrutural mudar.

## 1. Visão geral e acesso

- **O que é:** SaaS de gestão de agência de marketing do **Grupo 10+** (substitui o GoHighLevel). Aprovação de conteúdo, esteira de produção, publicação em Instagram/Facebook, tarefas, playbook, IA, analytics, financeiro e gestão de equipe.
- **Diretório local:** `C:\Users\Wiliam\ai-marketing-claude\approval-system`
- **Repositório:** GitHub `10mais/soma10-approval` (branch principal: `main`)
- **Deploy:** Vercel (auto-deploy ao dar **push na `main`**). 
  - Project ID: `prj_YdVAuroNquvgupyffXz3UxR6MF2J` · Team ID: `team_O5nshKfp0iI8T3WUf6vZFN2b`
  - Domínio de produção: **https://approval.soma10.com.br**
  - **Região das funções: `gru1`** (São Paulo) — fixada em `vercel.json` para ficar perto do banco.
- **Stack:** Next.js 14.2.3 (App Router, componentes client), TypeScript, NextAuth (JWT), Upstash Redis (`@upstash/redis`), Vercel Blob (mídia), Anthropic SDK (IA), nodemailer (e-mail), sharp (normalização de imagem), jsPDF (relatórios).
- **Banco:** Upstash Redis em **sa-east-1 (São Paulo)**, endpoint `right-owl-106248.upstash.io`, provisionado via Vercel Marketplace (vars `KV_REST_API_*`). Plano **Pay-as-you-go**.
- **Modelo de IA padrão:** `claude-opus-4-8`.

## 2. Como rodar, validar e deployar

- **Type-check (sempre antes de commitar):**
  `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- **Deploy:** commit + `git push origin main` → Vercel builda sozinho (~1 min). Depois **Ctrl+Shift+R** no navegador (cache de bundle).
- **Mensagem de commit:** terminar com `Co-Authored-By: Claude ...`.
- **Diagnóstico em produção:** dá para ver deployments e erros de runtime via Vercel MCP (`list_deployments`, `get_runtime_errors`, `get_deployment_build_logs`).

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Var | Uso |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (Marketplace) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (upload de mídia/anexos). **Store é privado** — uploads usam o fluxo client `upload()` |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | NextAuth |
| `APP_ID`, `APP_SECRET` | Meta (Facebook/Instagram) OAuth + publicação |
| `INSTAGRAM_APP_ID` | Login "API com login do Instagram" |
| `META_API_VERSION_PUBLISH` | (opcional) versão da Graph API, default v21.0 |
| `GOOGLE_DRIVE_API_KEY` (ou `GOOGLE_API_KEY`) | proxy/list do Drive (server) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY` | Google Picker (client) — só aparece o botão se ambos existirem |
| `SMTP_HOST` (default smtp.titan.email), `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS` | e-mail (aprovações, resumo semanal) |
| `NOTIFY_EMAIL` | destino dos e-mails de decisão (marketing@grupo10mais.com.br) |
| `CRON_SECRET` | protege os endpoints de cron |
| `APPROVAL_BASE_URL` | base usada em links de aprovação |

> Regra de segurança do dono: **nunca colar tokens/secrets no chat** (só nomes). Logo do "Trabalhe Conosco" oficial do 10+ ainda a subir pela tela.

## 4. Modelo de dados (Redis) — `lib/redis.ts`

**Padrão de chaves:** objeto em `entidade:{id}`; índices em sets (`smembers`).
Sets: `clientes`, `usuarios`, `posts`, `agendados` (ids de posts status=agendado), `tarefas`, `tarefas_excluidas`, `marcos`, `templates`, `despesas`, `candidaturas`, `briefings`, `plano:{id}:pautas`, `notificacoes:{email}`.
Config (chaves simples): `config:agencia`, `config:automacoes`, `config:anthropicSaldo`, `tipos:tarefa`, `tokens:ultimaRenovacao`. Locks/dedupe: `publicando:{postId}` (SET NX EX 600), `aprov_atraso:{postId}`, `renov_alerta:{clienteId}`, `tarefa_notif_*`.

**Entidades principais (campos-chave):**
- **Usuario** `usuario:{email}`: nome, email, senha(hash), role (`admin|gerente|usuario|vendas|cliente`), **permissoes** (override por módulo — boolean antigo OU `{ver,editar,excluir}`; ver §15.1), **funcaoVendas** (`sdr|bdr|closer`, p/ role vendas), cargo, foto, telefone, clienteId, **custoHora**, **salarioFixo**, **salarioVariavel** (=valorPorProjeto×qtdProjetos), **valorPorProjeto**, **qtdProjetos**.
- **Cliente** `cliente:{id}`: nome, instagram, logo, corPrimaria/Secundaria, tipo (`cliente|interno`), **entregaveis[]** (social_media, trafego_meta, trafego_google, landing_page, branding, email_marketing, consultoria, crm, google_meu_negocio, **hospedagem**), **postsMensais** (meta), contrato (**contratoValor** recorrente, contratoInicio/Renovacao/Ciclo), **receitasAvulsas[]** (mes/valor/descricao = pontual/modular), Brand Board (segmento, palavrasChave, descricao, publicoAlvo, tomDeVoz, preferencias, documentos[], documentoMarca), Meta/IG (facebookPageId/Token, instagramBusinessId/Username, metaConectado, instagramToken/UserId/Conectado), **loginEmail/loginSenha**, **statusToken** (link público).
- **Post** `post:{id}`: clienteId/Nome, imagens[], legenda, **status** (rascunho|agendado|aguardando_aprovacao|aprovado|corrigir|reprovado|**publicando**|publicado|falha_publicacao), formato (feed|reel|story), dataAgendada, codigo (6 díg), colaboradores[], capasVideo{}, redes[], **redesPublicadas[]** (anti-duplicata), **etapa** (briefing|copy|aprovacao_copy|criativo|aprovacao_criativo|pronto), planoId, briefing, sugestaoImagem/Legenda, ajusteCopy/Criativo, copyAprovadaEm, criativoAprovadoEm, **aguardandoDesde** (SLA), **etapaDesde** (cycle-time), **preAprovado**, thumbnail, midiaRemovida, marcoId.
- **Tarefa** `tarefa:{id}`: titulo, descricao, tipo (11 embutidos + custom em `tipos:tarefa`), status (a_fazer|em_andamento|em_revisao|concluido), prioridade, responsavelEmail/Nome, clienteId/Nome, **marcoId**, prazo, anexos[] (com anotacoes), atividades[], comentarios[], **apontamentos[]** (horas), **checklist[]** (Definition of Done).
- **Marco** `marco:{id}` (Playbook): clienteId/Nome, titulo, descricao, categoria (social_media|trafego|branding|landing_page|estrategia|reuniao|entrega|outro), status (planejado|em_andamento|concluido|atrasado|cancelado), dataInicio/Fim, responsavelNome, atualizadoEm.
- **Plano** `plano:{id}` (mês da esteira): clienteId, mes, ano, titulo.
- **TemplateProjeto** `template:{id}`: nome, descricao, marcos[] (titulo/categoria/diasDuracao), tarefas[] (titulo/tipo/prioridade/marcoIndice).
- **Despesa** `despesa:{id}`: descricao, valor, tipo (fixo|variavel), mes ('YYYY-MM'), categoria.
- **BriefingCampanha** `briefing:{id}`: titulo, objetivo, plataformas[], verba, periodo, publico, oferta, conteudo(markdown), marcoId.
- **Candidatura** `candidatura:{id}`: nome, email, telefone, vaga, mensagem, curriculoUrl, status (nova|em_analise|aprovada|reprovada).
- **Notificacao** `notificacao:{id}` + set `notificacoes:{email}`: tipo, titulo, mensagem, postId, lida.
- **ConfigAgencia** `config:agencia`: nomeAgencia, logo, cores + **recrutamento\*** (logo/titulo/subtitulo/descricao/mensagemFinal\* do Trabalhe Conosco).
- **Automacoes** `config:automacoes`: postAprovadoCriaTarefa, etapaConcluidaNotifica, clienteNovoNotifica.

## 5. APIs (`app/api/**`)

- **posts** GET(?id=/clienteId)/POST/PUT(seta etapaDesde/aguardandoDesde)/DELETE · **publicar** POST(lock anti-dup, status publicando) · **decision** POST(aprovação pública por código ou sessão + publica + e-mail + automação)
- **esteira/aprovar** POST(avança etapa, seta etapaDesde) · **esteira/gerar-plano**, **esteira/gerar-legenda** (IA) · **planos** CRUD
- **clientes** CRUD(POST/PUT admin; PUT aceita brand/contrato/receitasAvulsas; automação cliente novo) · **clientes/conectar**
- **tarefas** CRUD + ações no PUT: novoComentario, editar/excluirComentario, **apontarHoras/removerApontamento**, checklist · **tipos-tarefa** GET/POST/DELETE
- **playbook** CRUD(+automação etapa concluída) · **playbook/entregas** GET · **templates** CRUD · **templates/aplicar** POST(gera marcos+tarefas)
- **usuarios** CRUD(admin; custoHora/salarios) · **meu-perfil** GET/PUT · **colab** GET (menções)
- **rentabilidade:** **despesas** CRUD(admin; POST aceita `meses[]` p/ recorrência)
- **automacoes** GET/PUT · **status** GET(público por token)/POST(gera token) · **resumo-semanal** GET(texto)/POST(envia e-mail)
- **recrutamento** GET(público) · **candidaturas** POST(público)/GET/PUT/DELETE(admin) + **candidaturas/upload** · **solicitar-briefing** POST · **briefings** CRUD + **briefings/gerar**
- **brand/gerar-documento** POST(IA+web search) · **analytics** GET(Meta real) · **social-listening** GET · **anthropic-saldo** GET/PUT
- **meta/oauth|callback|pages|diagnostico** · **instagram/oauth|callback** · **drive-import** GET(stream)/POST(lista pasta) · **upload** (handleUpload Blob) · **config** GET/PUT(admin) · **mensagens** CRUD · **notificacoes** GET/PUT/DELETE
- **Crons:** **cron/publicar** (agendados + renova token IG), **cron/alertas** (SLA aprovação 24h + renovação contrato), **cron/tarefas** (prazos), **cron/resumo-semanal** (digest semanal)

## 6. Crons a configurar (cron-job.org externo, com `?secret=CRON_SECRET`)

- `GET /api/cron/publicar` — **a cada 1–5 min** (publica os agendados). **Já funciona** (há posts agendados que saíram sozinhos).
- `GET /api/cron/alertas` — a cada 1–3h (SLA de aprovação + renovação de contrato).
- `GET /api/cron/tarefas` — a cada 1h (prazos de tarefa).
- `GET /api/cron/resumo-semanal` — **1x/semana** (envia o resumo por e-mail aos clientes com login). *(novo — confirmar se está agendado)*

## 7. Integrações externas

- **Meta (Facebook/Instagram):** `lib/publicar.ts`. Publica feed/reel/story/carrossel; FB usa `file_url` p/ vídeo (evita OOM), sharp normaliza imagem (CMYK→sRGB). Lock atômico `publicando:{id}`. Reels: espera de container maior (~210s).
- **Anthropic Claude:** brand doc, plano e legenda da esteira, briefings. Controle de saldo em `lib/anthropicSaldo.ts` (admin cadastra saldo; alerta só admins).
- **Google Drive Picker:** `app/components/DriveButton.tsx` (OAuth client, token em cache na sessão, `prompt:''`). Importa criativos na ordem numérica. Precisa Picker API ativada + chave liberada para Drive **e** Picker.
- **SMTP (nodemailer):** e-mails de decisão e resumo semanal.
- **Vercel Blob:** uploads via `upload()` (client) com barra de progresso (`UploadProgress.tsx`).

## 8. Navegação e papéis

**Papéis (hierarquia):** `admin` > `gerente` > `usuario` > `vendas` > `cliente`.
- `admin` — vê tudo (único que vê o **Financeiro** e atribui permissões).
- `gerente` — operacional amplo (padrão: Produção/Estratégia/CRM ligados; Clientes/Financeiro não).
- `usuario` — papel limitado (padrão: só Produção ver/editar; sem Estratégia/CRM/Clientes/Financeiro), tudo ajustável pelo admin.
- `vendas` — SDR/BDR/Closer; nav restrita a **CRM, Meu dia, Personal list, Mensagens** (não vê a operação).
- `cliente` — portal do próprio projeto.

**Permissões (modelo atual — ver §15.1):** matriz **Ver / Editar / Excluir** por módulo (`producao | estrategia | crm | clientes`; `financeiro` é sempre admin-only). Configurável **por papel** (`config:permissoesPapel`) e **por usuário** (`Usuario.permissoes`, override individual). Só o admin edita. Lógica client-safe em `lib/permissoesCatalogo.ts` (`podeNivel`, `normalizaNivel`); enforcement de servidor em `lib/permissoesPapel.ts` (`bloqueiaPapel`).

**Dashboard (agência) — `app/dashboard/page.tsx`, estado `aba`:**
- Visão geral: **Meu dia**, Painel, **Personal list**
- Produção: Tarefas, Esteira, **Carga da equipe**
- Estratégia: Playbook, Campanhas, **Modelos**, **Automações**
- Vendas: **CRM**
- Comunicação: Inbox, Mensagens
- **Gestão (admin):** **Financeiro** (aba interna ainda chamada `rentabilidade`, componente `Rentabilidade.tsx`)
- **Configurações (admin):** Geral, Clientes, **Notificações do sistema**, **Operacional**, **Permissões por papel** (hub ainda não reorganizado em abas — ver §12)
- **Pessoas e Cultura (admin):** Colaboradores, Candidaturas, Página Trabalhe Conosco
- Cada aba mapeia a um grupo de permissão em `ABA_GRUPO`; `podeGrupo`/`podeNivelDash` filtram nav e botões. "Acessar sub-account" (edição) vs "Visualizar como cliente" (read-only).

**Portal do cliente — `app/cliente/[clienteId]/layout.tsx` (`NAV_ITEMS`):**
- "O que o cliente vê": Início, Entregas, Aprovações, Solicitar conteúdo, Esteira, Planner
- "Ferramentas da equipe" (só equipe): Playbook, Marca, Social Listening, Analytics
- Banner cross-portal "X itens aguardando sua aprovação" + badge em Aprovações.

**Páginas públicas (sem login):** `/login`, `/trabalhe-conosco`, `/aprovar/[id]`, **`/status/[token]`** (status do cliente).

## 9. Fluxo de produção (Esteira × Aprovações × Planner)

**Esteira** = fábrica (produção, kanban por etapa). **Aprovações** = visão do cliente dos 2 portões (aprovacao_copy/criativo). **Planner** = agenda do que está pronto/agendado/publicado. Ciclo: produz na Esteira → cliente aprova → vira "pronto/agendado" → aparece no Planner → publica. "Nova postagem" no Planner = atalho avulso (pula a esteira).

## 10. Histórico de evolução (3 fases + 13 aceleradores)

- **Fase 1 (Clareza):** navegação agrupada; escopo contratado×entregue + meta editável + onboarding automático na página Entregas.
- **Fase 2 (Gestão):** apontamento de horas (timer com segundos + manual), custo/hora; **Rentabilidade** (DRE: receita − folha[fixo+variável] − despesas; despesas única/recorrente; remuneração da equipe; por cliente/profissional; cobranças avulsas/modulares).
- **Fase 3 (Escala):** **Modelos de projeto** (etapas+tarefas aplicáveis em 1 clique); **Automações** curadas (toggles).
- **Pessoas e Cultura:** Trabalhe Conosco personalizável (logo/título/descrição/end page) + Compartilhar; notificações só admin.
- **13 aceleradores de operação (todos entregues):**
  1. Cycle-time/aging + gargalo na Esteira · 2. Limite de WIP · 3. Aprovação em lote + cobrança no WhatsApp · 4. Conteúdo pré-aprovado · 5. Reaproveitar (1→3) · 6. Definition of Done (checklist por tipo) · 7. **Status page pública** · 8. Banner "o que espera você" · 9. **Resumo semanal** (WhatsApp/e-mail) · 10. Prometido×Realizado + SLA · 11. Risco de atraso preditivo · 12. Carga da equipe · 13. **Meu dia** (abre a tarefa no mesmo modal).

## 11. Convenções e regras (não violar)

- **UI sem emoji** — só ícones SVG profissionais.
- **Erros sempre em VERMELHO.**
- **NUNCA misturar dados entre clientes** (ordem definitiva — ler sempre por `?id=` fresco, resetar estado ao trocar de cliente).
- **Deploy = push na `main`.** Sempre rodar type-check antes.
- Componentes pesados via `dynamic(() => import(...), { ssr:false })`.
- Cor da marca do cliente: `var(--marca)` no portal; em alguns componentes a cor é passada direto do cliente.
- Auto-aprovar (global CLAUDE.md): criar arquivos/pastas novos, instalar pacotes pedidos, componentes visuais. **Perguntar antes:** modificar arquivo existente, comandos de banco, `.env`/auth, refator >3 arquivos, deletar.

## 12. Pendências / próximos passos

> ⚠️ **ESTADO MAIS RECENTE (2026-07-08): LEIA §28 → §27 → §26 → §25 PRIMEIRO.** §28 (**Robustez — Visão A**: observabilidade `lib/erros.ts` + tela Config→Saúde do sistema, revogar link status/NPS, **rede de segurança de testes com portão no build**). Antes: §24 (**Fase 1.5** — visões cliente dos add-ons), §25 (**Fase 2 billing** + suspensão + hardening + **§25.5 Stripe scaffold** + **§25.6 rate limiting + rotação do link de aprovação**), §26 (**aprovação CONSOLIDADA** "Solicitar ajustes" + EM AJUSTE), §27 (**log de solicitações 30d, fix Planner, Calendário, prévia 4:5**).
>
> **TRACK: abrir o sistema para clientes externos + monetização modular.** Fases **0 ✅ · 1 ✅ · 1.5 ✅ (§24) · 2 ✅ (§25, inclui suspensão + hardening) · 3 (hardening de código) ✅** (§25.6: rate limiting nos endpoints públicos + revogação/rotação do link de aprovação). O sistema já está **pronto pra abrir pra clientes** no que depende de código.
>
> **PRÓXIMO — depende AÇÃO DO DONO (externo ao código):**
> 1. **Stripe (cobrança real):** setar **`STRIPE_SECRET_KEY`** + **`STRIPE_WEBHOOK_SECRET`** na Vercel e criar o webhook no dashboard do Stripe → `https://approval.soma10.com.br/api/stripe/webhook` (eventos `invoice.paid`/`invoice.payment_failed`/`customer.subscription.*`). Código 100% pronto (§25.5): botão "Cobrar via Stripe" na ficha + dunning que liga/desliga a suspensão sozinho.
> 2. **PIX recorrente** (opcional): Stripe só faz PIX avulso; recorrente nativo = provedor BR (Asaas/Pagar.me/Mercado Pago) — a construir se quiser não depender de cartão.
>
> **PRÓXIMO — CÓDIGO (opcional, pequeno):**
> - ~~Botão **revogar link** para **status** e **NPS**~~ — **FEITO (§28.2).**
> - ~~Visão de **entregas/posts por marco** no `MarcoDetalhe` do cliente~~ — **FEITO (§28.6).**
> - **"Reprovado" de verdade** no portal de aprovações (hoje "Rejeitar" entra como ajuste com texto "REJEITADO:", §26.3).
> - **Robustez (§28):** ligar `/api/health` num monitor de uptime; testar o restore do backup.
>
> **Nome do produto:** dono decidiu **MANTER "Soma10 Approval"**. Domínios livres se um dia revender white-label: `regencia.app`/`orquestre.app`/`batuta.studio`/`pauta.studio`.
>
> **Ação do dono já OK:** `IDEOGRAM_API_KEY` setado (§19.2, ligado em prod). Conferir o cron `backup` rodando (§22.2).
>
> A lista abaixo é histórico de backlog antigo (pré-2026-07-05); vários itens já foram entregues nas seções novas.

**Pendente — CÓDIGO:**
- **CRM Instagram Direct (Fase 3)** — depende do App Review da Meta (ação do dono).
- **Agentes de IA — Fase 3** (atribuir agente a uma tarefa/pauta; execução em background) + **mais ações** (gerar_legenda/mover_estagio_crm/agendar_followup — plugam no framework) + **tela de auditoria** (lista `agente:acoes`). Fases 1 e 2 já entregues (§16.7).
- **NPS** — não há coleta hoje; precisaria de uma feature de pesquisa antes de entrar no Dashboard de Conversão/Retenção (§16.9).
- **Empacotar nas lojas (Capacitor)** — scaffold pronto (`capacitor.config.json`, `CAPACITOR.md`); falta o dono ter as contas dev + rodar `cap add`.
- Menores: dashboard de Ads read-only (aguarda APIs Meta/Google); logomarca oficial em Trabalhe Conosco; migrar mídia de Analytics/Social Listening do IG p/ Blob (mesmo padrão do fix de logos, §16.5).

**Ação do dono (externo ao código):**
- **RE-SINCRONIZAR FOTOS (fazer 1x):** Config → Geral → card "Imagem de perfil dos clientes" → botão **"Re-sincronizar fotos do Instagram"** — conserta as logos de cliente quebradas (agora salvas no Blob, §16.5).
- **WhatsApp Cloud API** — número dedicado + System User token + webhook (`/api/whatsapp/webhook`) + templates HSM. Vars `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_VERIFY_TOKEN`. Scaffold pronto (§14.9).
- **Instagram:** conta profissional + **App Review** (para o CRM Instagram Direct).
- **App nas lojas:** contas dev **Apple (US$99/ano) + Google (US$25)** + Xcode/Android Studio; depois `cap add` (ver `CAPACITOR.md`).
- **Crons duplicados no cron-job.org** — desativar (nativos na Vercel, §15.4). **VAPID** conferir no Vercel.

**Ressalva de permissões:** override por usuário vem do JWT → só vale após relogar; defaults por papel valem na hora (§15.1).
**Otimização de fundo opcional:** ZSET cronológico p/ limitar a leitura do Redis da equipe (hoje janela 120d filtra após mget).
**Dívida técnica:** modo escuro é filtro de inversão (ideal um tema real). Imagens 403 do IG resolvidas p/ **logos de cliente** (§16.5); mídia de Analytics/Social Listening que use URL do IG ainda pode expirar.

## 13. Arquivos-chave

`lib/redis.ts` (tipos/chaves) · `lib/publicar.ts` (publicação Meta) · `lib/notificacoes.ts` (`notificar`, `notificarEquipe`, **`notificarAdmins`**) · `lib/automacoes.ts` · `lib/resumoSemanal.ts` · `lib/relatorioMensal.ts` · `lib/anthropicSaldo.ts` · `lib/cache.ts` · `lib/auth.ts` · `lib/modoCliente.ts`.
Componentes: `GestaoTarefas.tsx` (+ `TarefaModal` exportado), `Esteira.tsx`, `PostComposer.tsx`, `Playbook.tsx`, `EntregasMarco.tsx`, `DashboardHome.tsx`, `Rentabilidade.tsx`, `Modelos.tsx`, `Automacoes.tsx`, `MeuDia.tsx`, `CargaEquipe.tsx`, `DriveButton.tsx`, `UploadProgress.tsx`, `Candidaturas.tsx`, `Briefings.tsx`, `MinhaConta.tsx`, `Calendar.tsx`, `ChatInterno.tsx`, `ConectarRedesModal.tsx`, `OptImg.tsx`.
**Novos (evolução anterior):** `CRM.tsx` (módulo de vendas), `PersonalList.tsx`, `PushSetup.tsx`. Libs: `lib/webpush.ts`, `lib/whatsapp.ts`, `lib/postsIndex.ts`.
**Novos (sessão 2026-07-02 — ver §16.13):** `Agentes.tsx`, `Documentos.tsx`, `DashboardVendas.tsx`, `MapasMentais.tsx`, `AvatarCliente.tsx`. Libs: `lib/useIsMobile.ts`, `lib/blobFoto.ts`, `lib/crmPipelines.ts`. `RichText.tsx` ganhou prop `completo`.

## 14. Evolução 2026-06-29/30 (sessão grande) — novidades

> Tudo abaixo já está **deployado na `main`**. Fluxo: o dono prefere **push direto na main a cada implementação** (sem testar local). Type-check antes de cada commit.

### 14.1 Performance
- **Update otimista no dashboard:** ações de post (criar/editar/mover/duplicar/excluir/publicar) não rebaixam mais a coleção inteira; atualizam o estado local. Onde depende do servidor (publicar/republicar), busca 1 post.
- **Índice de posts por cliente** (`lib/postsIndex.ts`): `cliente:{id}:posts` construído **lazy** na 1ª leitura (flag `cliente:{id}:posts:indexed`), mantido em posts POST/PUT/DELETE e `esteira/gerar-plano`. `/api/posts?clienteId` e `role cliente` leem só o subconjunto.
- **Janela de 120 dias** na visão da equipe de `/api/posts` (recentes/futuros/atualizados); `?tudo=1` traz tudo; a aba **Biblioteca** carrega histórico completo.
- **`/api/status`** (link público): mapa reverso `statustoken:{token}→clienteId` (O(1)) + posts por cliente.

### 14.2 UI / shell
- **Barra superior preta removida** → cluster flutuante no topo-direito (tema/sino/“visualizar como”/conta/sair). **Logo (wordmark SOMA)** no topo da sidebar — arquivos `public/soma10-logo.png` (claro) e `soma10-logo-dark.png` (escuro); ícone `public/logo.svg` no modo recolhido.
- **Sidebar colapsável** (rail de ícones, preferência em `localStorage 'sidebarRecolhida'`); botão recolher flutuante; clicar item recolhido expande. Mapa de ícones por aba: `ICONE_ABA` no `dashboard/page.tsx`.
- **Modo escuro:** imagens em `.soma10-no-invert` ficam naturais; botões amarelos (#ffc00f) re-marcados via efeito (`.btn-amarelo`) para seguirem amarelos com texto branco. (Continua sendo dark mode por filtro de inversão — dívida técnica.)

### 14.3 Tarefas (`GestaoTarefas.tsx`)
- **Concluídas ocultas por padrão** + toggle “Concluídas (n)”. **Busca** (lupa, título/descrição) e **filtro por tipo**.
- **Guarda ao fechar:** fechar o modal (overlay/x) com alterações não salvas pede confirmação.
- **Subtarefas:** `Tarefa.tarefaPaiId`. Lista mostra mãe + subtarefas aninhadas (chevron recolhe/expande); botão `+` na linha da mãe = quick-add (nome + Enter). Kanban: subtarefas fora das colunas, card mostra “N subtarefa(s)”. Modal da mãe: seção **Subtarefas** (toggle concluir, quick-add, “abrir”) + **Anexos das subtarefas** (só leitura, agrega os anexos das filhas). Órfãs (mãe excluída) sobem ao topo.
- **Relacionar tarefa↔tarefa** (vínculo bidirecional manual): `Tarefa.relacionadas[]`, PUT ações `relacionarTarefa`/`desrelacionarTarefa`. Seção “Relacionadas” no modal.

### 14.4 Esteira / Briefings → Tarefa
- Esteira: botão **“Relacionar a tarefa”** dentro da pauta (individual) cria 1 tarefa (tipo = etapa: briefing/copy/criativo; pronto ignorado). `Post.tarefaId` ↔ `Tarefa.origemPostId`. Rota `/api/esteira/relacionar` (aceita `postId` ou `planoId`).
- Briefings: botão “Relacionar a tarefa” cria tarefa tipo **campanha**. `/api/briefings/relacionar`. Novos tipos de tarefa: **briefing, copy, campanha** (em `TarefaTipo` e no catálogo do `GestaoTarefas`).

### 14.5 Permissões de cliente
- `Cliente.permissoes` (`entregas/aprovacoes/aprovar/solicitar/esteira/planner`), default tudo-ligado (flag ausente = liberado). Editável em Configurações → Clientes. Enforcement: menu do portal filtrado + guard de URL no `app/cliente/[clienteId]/layout.tsx`; servidor bloqueia `/api/esteira/aprovar` (aprovar) e `/api/solicitar-briefing` (solicitar). Helper `podeCliente()` em `lib/redis.ts`.

### 14.6 Push + PWA (FUNCIONANDO)
- **Web Push:** `lib/webpush.ts` (`enviarPush` via `web-push`, no-op sem VAPID; poda inscrições 404/410). `/api/push/subscribe` (GET config+publicKey, POST/DELETE inscrição em `push:{email}`). `notificar()` dispara o push. `/api/push/test` (GET/POST) = diagnóstico (envia ao próprio usuário + checa se o par de chaves casa). Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **PWA:** `app/manifest.ts` + `public/sw.js` (push + clique) + ícones `public/icon-192/512.png`, `apple-touch-icon.png`. `PushSetup.tsx` (registra SW, botões Instalar/Ativar notificações). **Mensagens privadas** disparam push mas NÃO entram no Inbox (só na aba Mensagens) — `/api/notificacoes` filtra `mensagem_privada`.

### 14.7 Outras features
- **Personal list:** item de menu próprio (abaixo de Meu dia), área privada por usuário (`personal:{email}`), rascunho + microtarefas. `/api/personal`. `PersonalList.tsx`.
- **Notificação em modal:** clicar no Inbox abre a notificação em modal (não navega).
- **Resumo semanal com templates:** predefinições (intro/fechamento com `{cliente}`/`{periodo}`) em `config:resumoTemplates`; `/api/resumo-templates`; aplicado por `templateId` em `lib/resumoSemanal.ts`.
- **Vagas em dropdown** no Trabalhe Conosco: `config:agencia.recrutamentoVagas[]`, editável na Página Trabalhe Conosco; `/api/recrutamento` expõe.

### 14.8 CRM de vendas (módulo novo — grupo de menu “Vendas” → aba `crm`, `CRM.tsx`)
Abas internas: **Painel / Funil / Contatos / Empresas / Playbook**.
- **Entidades (Redis):** `negocio:{id}` (índice `crm:negocios`), `contato:{id}` (`crm:contatos`), `empresa:{id}` (`crm:empresas`). Config: `crm:estagios` (funil configurável, semente padrão Lead→…→Negociação + Ganho/Perdido), `crm:playbookQualificacao` (roteiro + cadência). Tipos: `CrmNegocio` (qualificação rica: empresa/segmento/faturamentoEstimado/instagram/dores/solucoes; `handoff`; `proximoFollowUp`; `contatoId`/`empresaId`; `clienteId`; timeline `atividades[]`), `CrmContato`, `CrmEmpresa`, `CrmEstagio`, `CrmHandoff`.
- **APIs:** `/api/crm/{negocios,contatos,empresas,estagios,playbook}` (CRUD) e **`/api/crm/converter`** (Ganho→Cliente).
- **Funil kanban** (arrastar entre etapas, mover registra na timeline). **Nome da oportunidade = nome do responsável (contato).**
- **Conversão Ganho→Cliente (`/api/crm/converter`):** modal de **passagem de bastão** (Closer→Gestor) → cria o Cliente (login opcional), **aplica um Modelo de projeto** (gera marcos+tarefas no Playbook), grava o handoff em `cliente.handoffVendas` (visível em Clientes→Editar), vincula o negócio e **notifica a equipe** (push+inbox) com a ficha. Refresh dos clientes no dashboard via prop `onClienteCriado`.
- **Contatos:** CRUD + **Adicionar vários** (cola N linhas), **Importar CSV** e **Exportar CSV** (POST aceita `{lote:[...]}`).
- **Empresas:** CRUD; agrupa contatos/negócios por `empresaId` OU por nome (texto) batendo.
- **Playbook de qualificação:** roteiro + cadência (dia/canal/título/script) com “Copiar script”; admin/gerente editam (com Cancelar).
- **Painel de vendas:** em aberto, ganho no mês, win rate, ticket médio, funil por etapa, pipeline por vendedor.
- **Lembretes:** `negocio.proximoFollowUp`; selo no card; cron `/api/cron/crm-followup` (diário, avisa o dono, dedupe 1x/dia).

### 14.9 WhatsApp oficial — scaffold backend (inativo até credenciais)
- `lib/whatsapp.ts`: `enviarWhatsApp(tel, texto)` via Graph API (no-op sem credenciais); `salvarMensagem` armazena conversa (`wa:conversa:{tel}`, `wa:msgs:{tel}` lista, índice `wa:conversas`). `whatsappConfigurado()`.
- `/api/whatsapp/webhook`: GET verificação (`hub.challenge` com `WHATSAPP_VERIFY_TOKEN`) + POST recebe mensagens → armazena → notifica equipe.
- Env: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (reusa `META_API_VERSION_PUBLISH`). **Falta:** inbox no CRM + templates (ver §12).

### 14.10 Novas chaves Redis (resumo)
`cliente:{id}:posts` (+ `:indexed`), `statustoken:{token}`, `push:{email}`, `personal:{email}`, `config:resumoTemplates`, `crm:negocios`/`negocio:{id}`, `crm:contatos`/`contato:{id}`, `crm:empresas`/`empresa:{id}`, `crm:estagios`, `crm:playbookQualificacao`, `crm_followup_notif:{id}:{data}` (dedupe TTL), `wa:conversas`/`wa:conversa:{tel}`/`wa:msgs:{tel}`. Campos novos: `Cliente.permissoes`/`handoffVendas`/`recrutamentoVagas`(config); `Post.tarefaId`; `Tarefa.tarefaPaiId`/`relacionadas`/`origemPostId`/`origemBriefingId`; `BriefingCampanha.tarefaId`.

### 14.11 Novas rotas API (resumo)
`/api/personal`, `/api/push/subscribe`, `/api/push/test`, `/api/resumo-templates`, `/api/esteira/relacionar`, `/api/briefings/relacionar`, `/api/crm/{negocios,contatos,empresas,estagios,playbook,converter}`, `/api/cron/crm-followup`, `/api/whatsapp/webhook`.

## 15. Evolução 2026-07 (permissões · financeiro · automações · IA · CRM · hub) — novidades

> Tudo abaixo já está **deployado na `main`**. Fluxo mantido: **push direto na main a cada implementação**, type-check antes de cada commit. Esta seção é o estado ATUAL; onde diverge das seções antigas (ex.: "Rentabilidade"→"Financeiro", papéis), vale o que está aqui.

### 15.1 Permissões Ver/Editar/Excluir (modelo + enforcement)
- **Client-safe:** `lib/permissoesCatalogo.ts` — tipos `GrupoPermissao` (`producao|estrategia|crm|clientes`), `Nivel` (`ver|editar|excluir`), `NivelPerm`. `PADRAO` por papel (gerente/usuario). `podeNivel(role, grupo, nivel, permUsuario?, configPapel?)` resolve: **override do usuário > config do papel > padrão**; `admin`→sempre true; `financeiro`→sempre false (exceto admin); não-(gerente|usuario)→false. `normalizaNivel` aceita o formato **antigo** (1 booleano por módulo) e converte p/ `{ver,editar,excluir}` — **retrocompatível**.
- **Servidor:** `lib/permissoesPapel.ts` reexporta o catálogo + `getPermissoesPapel()` (lê `config:permissoesPapel`), `papelPode(...)` e **`bloqueiaPapel(role, grupo, nivel, permUsuario)`** — retorna true SÓ quando o papel é gerente/usuario E não tem o nível; admin/vendas/cliente passam direto (mantêm as regras próprias de cada rota). Uso nas rotas: `if (await bloqueiaPapel(...)) return 403`.
- **Enforcement de servidor aplicado em** (commit `f253225`): tarefas (POST/PUT=editar, DELETE=excluir), posts (idem), esteira `gerar-plano`/`gerar-legenda`/`aprovar` (editar), playbook (editar; DELETE alinhado à matriz `estrategia/excluir`), templates + `templates/aplicar` (editar/excluir), crm `negocios`/`empresas`/`contatos` (editar/excluir).
- **Enforcement de cliente:** o dashboard calcula `podeNivelDash(grupo, nivel)` a partir de `session.user.permissoes` + `permPapel` e passa `podeEditar`/`podeExcluir` para `GestaoTarefas`, `Esteira`, `Playbook`, `Modelos`, `CRM` (e seus modais). Botões de criar/editar/excluir sem permissão são escondidos. Nav/abas filtradas por nível `ver` (`podeGrupo`, `ABA_GRUPO`, guard em `useEffect`).
- **UI de configuração:** matriz de caixinhas ✓/— na tela **Colaboradores** (padrão por papel) e no **cadastro/edição de cada usuário** (override individual) — função `matrizNiveis` no `dashboard/page.tsx`. Rota `/api/permissoes-papel` (GET/PUT admin). `Usuario.permissoes` no `lib/redis.ts` aceita boolean antigo OU objeto novo. **Só o admin** configura.
- **Ressalva:** override por usuário vem do JWT → só vale após relogar (ver §12).

### 15.2 Papéis `usuario` e `vendas`
- Hierarquia Admin > Gerente > **Usuário** > **Vendas** > Cliente (ver §8). `role`/`permissoes` propagados na sessão por `lib/auth.ts` (authorize → jwt → session). `vendas` = SDR/BDR/Closer, nav restrita (CRM/Meu dia/Personal/Mensagens); assistente e notificações filtrados para o contexto de vendas. Roster seguro de equipe em `/api/equipe`.

### 15.3 Módulo Financeiro (ex-"Rentabilidade") — admin-only
- Renomeado **Rentabilidade → Financeiro** (aba interna ainda `rentabilidade`, componente `Rentabilidade.tsx`). **Exclusivo do admin** (nenhum outro papel vê).
- **Saúde do Caixa** virou um **contagiro/velocímetro** (gauge, não termômetro). **Olho de privacidade** mascara **só os valores** (não borra a tela toda).
- **Fluxo de caixa** (entradas/saídas), **saldo previsto** e **lançamentos futuros**. APIs: `/api/financeiro/contas`, `/api/financeiro/lancamentos` (+ `/api/despesas`). Config operacional influencia a reserva (`saudeDias`).

### 15.4 Crons NATIVOS da Vercel
- `vercel.json` declara os crons (região `gru1`): `publicar` (`* * * * *`), `alertas` (`0 * * * *`), `tarefas` (`30 * * * *`), `crm-followup` (`0 11 * * *`), `resumo-semanal` (`0 11 * * 1`), **`automacoes` (`*/15 * * * *`)**.
- `lib/cronAuth.ts` `cronAutorizado(req)` aceita `?secret=CRON_SECRET` **OU** `Authorization: Bearer <CRON_SECRET>` (a Vercel manda o header). **Duplicatas no cron-job.org devem ser desligadas** (ver §12).

### 15.5 Motor de automações flexível (não engessado)
- **Registries client-safe:** `lib/automacoesCatalogo.ts` — `GATILHOS` (cada um declara os campos que expõe no ctx p/ as condições), `ACOES` (cada uma declara seus params), operadores de condição. Amplo e extensível (adicionar item = sem mexer no motor).
- **Motor (server):** `lib/automacoesEngine.ts` — `dispararEvento(gatilho, ctxRico)` filtra regras ativas por **escopo** (todos / selecionados / exceção por cliente) e **condições** (todas/qualquer), executa passo imediato e agenda os demais no **ZSET** `automacoes:pendentes` (trilha multi-passo com atraso em dias). `executarAcao` reutiliza writes existentes (criar_tarefa, criar_marco, notificar, enviar_email, aplicar_template, mover_etapa, etc.).
- **Fila:** `/api/cron/automacoes` (protegido por `cronAutorizado`) processa os passos vencidos.
- **Regras:** `config:automacoesRegras` (`Automacao[]`). CRUD em `/api/automacoes` (write **admin-only**). Construtor visual em `Automacoes.tsx` (gatilho → condições → escopo → sequência de passos). Wiring de `dispararEvento` em clientes/converter/negocios/decision/playbook/tarefas/posts. O toggle antigo `lib/automacoes.ts` + `config:automacoes` ainda coexiste (migração/limpeza futura).

### 15.6 Hub de configurações — preferências de notificação + operacional
- **Notificações:** `lib/notificacoesCatalogo.ts` (catálogo de tipos). Admin liga/desliga tipos globalmente (`config:notificacoes.desabilitados`) em **Config → Notificações do sistema** (`NotificacoesConfig.tsx`, `/api/notificacoes-config`). Cada usuário silencia os SEUS tipos + push (`notif:prefs:{email}`, `/api/notif-prefs`) em Minha Conta. `notificar()` em `lib/notificacoes.ts` respeita ambos.
- **Operacional:** `lib/operacional.ts` + `/api/operacional` + `OperacionalConfig.tsx` — `config:operacional` `{ slaAprovacaoHoras=24, lixeiraDias=30, saudeDias=60, prioridadePadrao='media' }`. Ligado no cron/alertas (SLA), tarefas POST (prioridade padrão), Financeiro (reserva=despesaOpMensal×saudeDias/30) e lixeira do `GestaoTarefas`.
- **FALTA:** reorganizar tudo isso num hub com abas (ver §12 — próximo passo).

### 15.7 Assistente de IA flutuante + acesso ao banco (tool-use)
- Ícone amarelo no canto; chat em streaming `/api/assistente/chat` (`AssistenteIA.tsx`). **Tool-use:** `lib/assistenteTools.ts` expõe `consultar_tarefas/clientes/crm/financeiro` (loop de tools no chat; **financeiro só p/ admin**). Prompt e ferramentas mudam quando `role=vendas` (foca vendas/funil, com web search).

### 15.8 CRM — refinamentos + toasts globais
- **Toasts globais:** `lib/toast.ts` + `Toaster.tsx` substituíram TODOS os `alert`/`confirm` nativos (inclusive `confirmar(...)` async com opção de perigo).
- **CRM:** empresa↔contato vinculados; negócio exige **contato + empresa**; responsável só admin/vendas; ao agendar reunião, **briefing vai a todos os Closers**; **Central de mensagens (inbox WhatsApp Fase 1)** `/api/crm/mensagens` + aba Mensagens; **cadência/agendamentos Fase 2** (`CrmAgendamento[]` no negócio, cadência do Playbook, cron `crm-followup`, selo no card). Conversão Ganho→Cliente já documentada em §14.8.

### 15.9 Editor rico, anexos, recorrência, relatório editável
- **`RichText.tsx`** (contentEditable, `document.execCommand`) na descrição de tarefas; `ehHtml` detecta entidades (fix `&nbsp;` literal); link abre em clique simples.
- **Anexos múltiplos** (seleciona vários arquivos de uma vez). **Tarefas recorrentes** (`Tarefa.recorrencia` diaria|semanal|quinzenal|mensal; ao concluir, gera a próxima ocorrência).
- **Relatório mensal do cliente em PDF, editável antes de exportar:** `RelatorioMensalEditor.tsx` + `lib/relatorioMensal.ts` (jsPDF).

### 15.10 Personal list → Notas
- Substituído o "Rascunho" único por **Notas** estilo post-it / Notas do iOS (`PersonalList.tsx`): cards coloridos (paleta), grid responsivo, autosave; migração automática do rascunho antigo → 1 nota. **Microtarefas** mantidas. `personal:{email}` ganhou `notas[]` (`/api/personal` sanitiza).

### 15.11 Novos arquivos / chaves / rotas (resumo desta fase)
- **Libs:** `permissoesCatalogo.ts`, `permissoesPapel.ts`, `automacoesCatalogo.ts`, `automacoesEngine.ts`, `cronAuth.ts`, `operacional.ts`, `notificacoesCatalogo.ts`, `assistenteTools.ts`, `toast.ts`, `relatorioMensal.ts`.
- **Componentes:** `AssistenteIA.tsx`, `Automacoes.tsx`, `NotificacoesConfig.tsx`, `OperacionalConfig.tsx`, `RichText.tsx`, `RelatorioMensalEditor.tsx`, `Toaster.tsx`.
- **Rotas:** `/api/permissoes-papel`, `/api/operacional`, `/api/notificacoes-config`, `/api/notif-prefs`, `/api/automacoes`, `/api/cron/automacoes`, `/api/assistente/chat`, `/api/equipe`, `/api/financeiro/{contas,lancamentos}`, `/api/crm/mensagens`.
- **Chaves Redis:** `config:permissoesPapel`, `config:operacional`, `config:notificacoes`, `notif:prefs:{email}`, `config:automacoesRegras`, `automacoes:pendentes` (ZSET), `crm:mensagens`/conversas. Campos: `Usuario.permissoes` (boolean antigo OU `{ver,editar,excluir}` por módulo); `Tarefa.recorrencia`; `CrmNegocio.agendamentos[]`.

## 16. Evolução 2026-07-02 (sessão longa) — portal do cliente, mobile/PWA, CRM pipelines, Agentes, Docs, Dashboard vendas, Mapas mentais

> Tudo abaixo **deployado na `main`** (push por implementação, type-check antes de cada commit). Onde diverge de seções antigas, vale o que está aqui.

### 16.1 Portal do cliente pronto para uso
- **Layout único da agência** (removeu tema por cliente): `app/cliente/[clienteId]/layout.tsx` header **neutro branco/escuro**, `--marca` fixo no amarelo Soma10 (botões via `var(--marca)`); `planner`/`entregas`/`status` neutralizados. Brand Board (`marca/`) segue = conteúdo, não layout.
- **Aprovação mais fácil:** `aprovacoes/page.tsx` ganhou **visualizador de mídia em tela cheia** (clique-para-ampliar capa/carrossel/vídeo, setas + teclado, contador).
- **Conta do cliente enxuta:** `MinhaConta.tsx` esconde campos de equipe (Cargo/Bio/Nível) quando `role==='cliente'`.

### 16.2 Mobile + PWA "cara de app"
- **Hook `lib/useIsMobile.ts`** (matchMedia ≤768px). Portal e dashboard viram **drawer + hambúrguer** no mobile; **barra de navegação inferior** (portal: Início/Aprovar/Entregas/Menu; dashboard: Início/Meu dia/Mensagens/Menu — abas universais).
- **Cara de app:** `app/globals.css` (sem tap-highlight/bounce/seleção em UI), `viewport-fit=cover`, **safe-area** (notch/barra inferior), **splash iOS** geradas em `public/splash` + `appleWebApp.startupImage`, fix meta `mobile-web-app-capable`, manifest `id`+`orientation`. **Banner de instalação** (`PushSetup.tsx`) sobe acima da barra no mobile; assistente idem.
- **Telas internas polidas:** PostComposer empilha; tabela de Tarefas rola horizontal (minWidth); grids fixos → responsivos.

### 16.3 Capacitor scaffold (app nas lojas — etapa 2)
- `capacitor.config.json` (**modo hospedado**: `server.url` = produção, pois é Next SSR) + **`CAPACITOR.md`** (guia passo a passo) + `.gitignore` (/android //ios/chaves). Config em JSON de propósito (não entra no tsc/build). Falta ação do dono (contas dev + `cap add`).

### 16.4 Hub de Configurações em abas
- Aba `config` (`dashboard/page.tsx`) virou **hub com abas internas** (`abaConfig`): **Geral** (aparência/dados/créditos IA/fotos), **Operacional**, **Notificações** (sistema+SMTP), **Integrações** (status+contas sociais) + **atalhos** (ícone ↗) p/ Clientes/Colaboradores/Automações. Fecha o "sistema de configurações robusto".

### 16.5 Fix definitivo das fotos do Instagram (logos de cliente)
- Causa: `cliente.logo` recebia `profile_picture_url` do IG (URL de CDN temporária → 403 ao expirar). **`lib/blobFoto.copiarFotoParaBlob`** baixa e salva no Vercel Blob (URL permanente); `clientes/conectar` usa a cópia. **`/api/clientes/resync-fotos`** (admin) + botão em Config→Geral rebusca/re-salva os já conectados (**dono deve clicar 1x**). Fallback visual `AvatarCliente.tsx` (inicial ao falhar) aplicado em todos os pontos.

### 16.6 CRM — contatos, autônomo, origem, MÚLTIPLOS PIPELINES
- **Contatos:** visão em **Lista** (tabela) + Cards; **seleção múltipla + selecionar todos + excluir em massa** (`/api/crm/contatos` DELETE aceita `?ids=`); campo **Área de atuação**; checkbox **Profissional Autônomo** (PF sem empresa). Busca de contato por nome ao criar oportunidade.
- **Origem** vira dropdown editável (datalist: padrões + já usadas).
- **Pipelines (funis) múltiplos:** tipo `CrmPipeline` + `lib/crmPipelines.ts` (setup/migração idempotente — estágios antigos caem no pipeline padrão "Comercial") + **`/api/crm/pipelines`** (GET/POST cria com etapas padrão/PUT renomeia/DELETE reatribui negócios). `CrmEstagio.pipelineId` e `CrmNegocio.pipelineId`. UI: seletor de pipeline no Funil/Painel, **"Gerenciar pipelines"** (criar/renomear/excluir), **"Editar etapas"** (renomear/adicionar/reordenar/remover — Ganho/Perdido obrigatórios), **"Mover para pipeline"** no card. Estágios PUT preserva os demais pipelines.

### 16.7 Agentes de IA treinados (Fases 1 e 2)
- **Fase 1 (conversa+leitura):** tipo `Agente` (redis) + **`/api/agentes`** (GET equipe; escrita admin) + tela admin `Agentes.tsx` (persona/instruções/ferramentas/cor/ativo). No assistente flutuante (`AssistenteIA.tsx`) há **seletor "Falar com"**; `/api/assistente/chat` aceita `agenteId` → monta o system das instruções + filtra tools pelo que o agente tem (respeita papel; financeiro só admin).
- **Fase 2 (executam ações, human-in-the-loop):** `assistenteTools.ts` ganha **FERRAMENTAS_ACAO** (`criar_tarefa`, `criar_marco`) + `ehAcao`/`resumoAcao`/`ferramentasAcaoSchemas`. No chat elas **NÃO executam** — viram **propostas** (sentinela `␞`+JSON no fim do stream). **`/api/agentes/executar`** executa só após o usuário confirmar, respeitando `bloqueiaPapel` + **auditoria** `agente:acoes` (200 últimas). Cartões Confirmar/Descartar no chat. Agente marca ações com selo "AÇÃO".

### 16.8 Documentos internos (tipo Google Docs)
- Tipo `Documento` + **`/api/documentos`** (equipe vê tudo; excluir só autor/admin) + `Documentos.tsx` (lista→editor modal, autosave). **RichText modo `completo`** (títulos H1/H2, listas, citação, alinhamento). **Link público** de leitura: `documento.token`+`doctoken:{token}`, **`/api/doc-publico`**, página **`/doc/[token]`**, botão Compartilhar + Revogar.

### 16.9 Dashboard de Conversão & Retenção
- **`/api/dashboard-vendas`** (admin/gerente/vendas) agrega CRM (win rate, ticket médio, em aberto, ganhos no mês, pipeline por vendedor) + carteira (MRR, LTV médio, **renovações ≤45d**, **risco de churn por inatividade ≥21d** sem post). `DashboardVendas.tsx`. Nav "Conversão & Retenção" (grupo Vendas + papel vendas). **NPS não incluído** (sem coleta).

### 16.10 Mapas mentais
- Tipo `MapaMental` (`nos`/`conexoes`/`layout`) + **`/api/mapas`** (+ **`/api/mapas/gerar-ia`** = Claude devolve JSON → árvore → organograma). `MapasMentais.tsx`: canvas com **zoom/pan** (scroll centrado + botões), **nós "pill"** (ponto colorido **amarelo #ffc00f por padrão** + texto), **conexões curvas/cotovelo na cor amarela da marca**; **barra flutuante** por nó (editar/cor/+filho/conectar/excluir) + **"+" discreto na borda** ao selecionar; **atalhos Enter=irmão, Tab=filho, Delete=apaga**; **exclusão em cascata** (apaga a sub-árvore — 1 única raiz); **raiz protegida/destacada** (pill escuro, sem excluir); **arrastar leva a sub-árvore junto**; **layouts Mapa mental / Organograma / Lista** (auto-organiza, persiste). Novo mapa: **do zero ou com IA** (modal).

### 16.11 Personal list → NOTEPADS
- As notinhas post-it viraram **Notepads** (documento com título + texto formatado, estilo ClickUp): lista título+prévia → **editor em modal** com `RichText`; criar/renomear/editar/excluir, autosave. `PersonalData.notepads[]` (migra notas/rascunho antigos). Microtarefas mantidas.

### 16.12 Esteira / pauta (ajustes)
- **"Relacionar a tarefa"** na Esteira: agora **busca e vincula a uma tarefa EXISTENTE** (mesmo cliente) + "Criar tarefa nova". `/api/esteira/relacionar` aceita `{ postId, tarefaId }`.
- **Nova pauta:** guard "Alterações não salvas" ao clicar fora (via `confirmar()`).

### 16.13 Novos arquivos / chaves / rotas (resumo desta fase)
- **Libs:** `useIsMobile.ts`, `blobFoto.ts`, `crmPipelines.ts`.
- **Componentes:** `AvatarCliente.tsx`, `Agentes.tsx`, `Documentos.tsx`, `DashboardVendas.tsx`, `MapasMentais.tsx`. `RichText.tsx` ganhou prop `completo`. `PersonalList.tsx`/`Documentos.tsx` reusam `RichText`.
- **Rotas:** `/api/agentes` (+ `/api/agentes/executar`), `/api/documentos`, `/api/doc-publico`, `/api/dashboard-vendas`, `/api/mapas` (+ `/api/mapas/gerar-ia`), `/api/crm/pipelines`, `/api/clientes/resync-fotos`. Página pública `/doc/[token]`.
- **Chaves Redis:** `agente:{id}`/`agentes`, `agente:acoes` (auditoria), `documento:{id}`/`documentos`/`doctoken:{token}`, `mapa:{id}`/`mapas`, `crm:pipelines`. Campos: `Agente`; `Documento.token`; `MapaMental.layout`; `CrmContato.areaAtuacao`/`profissionalAutonomo`; `CrmEstagio.pipelineId`; `CrmNegocio.pipelineId`; `PersonalData.notepads[]`.
- **Config:** `app/globals.css` (novo), `capacitor.config.json`, `CAPACITOR.md`, `public/splash/*`.

## 17. Evolução 2026-07-04 — App Review Meta, Instagram Direct, Conhecimento IA-First, Aprovação de Criativos

> Tudo **deployado na `main`** (push por implementação, type-check antes de cada commit). Onde diverge de seções antigas, vale o que está aqui. Último commit da sessão: `ceb382a`.

### 17.1 App Review Meta — SUBMETIDO (análise em andamento)
- App **PUBLICADO** (Live). **Business Verification concluída** (GRUPO 10+ LTDA). Caminho: "API do Instagram com login do Instagram". App do Instagram `soma10-IG` (ID `811562411808826`); app principal ID `1687925802347345`.
- **8 permissões submetidas:** `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `pages_manage_posts`, `pages_show_list`, `pages_read_engagement`, `public_profile`. (Anúncios e WhatsApp ficaram FORA — pedir só o que já está construído.)
- **Páginas legais** criadas e no ar (server components): `/privacidade`, `/termos`, `/exclusao-de-dados` (em approval.soma10.com.br; domínio raiz soma10.com.br NÃO resolve). Dropdown "Exclusão de dados" = URL de instruções.
- **Vídeo/credenciais de teste:** vídeo no YouTube não listado `https://youtu.be/rhTd_wpI_oY`. Login revisor: `revisor.meta@grupo10mais.com.br` / `Meta2026%`. O uploader de screencast por-permissão só funciona em **janela anônima** (bug da Meta); o de "documentação de apoio" aceita arquivos grandes.
- **Tratamento de dados:** operadores = Vercel Inc. + Upstash Inc. (categoria "Soluções e serviços de TI/nuvem", países Brasil+EUA). Controlador = Grupo 10+ LTDA (Brasil). Sem solicitações de segurança nacional.
- **NÃO MEXER enquanto em análise:** manter app publicado, vídeo no YouTube, login de teste ativo, contas conectadas no ar. Detalhes vivos em [[app-review-meta]].

### 17.2 Instagram Direct no CRM (multicanal)
- **Central de mensagens do CRM virou multicanal** (`CRM.tsx > MensagensInbox`): abas **WhatsApp | Instagram** reusando o mesmo componente via `CANAL_CFG` por canal. Persistência de aba/canal em sessionStorage.
- **Conta de mensagens da AGÊNCIA** (separada de clientes): `ContaMensagemIg` em `config:contasMensagensIg`. Botão "Conectar conta do Instagram (mensagens)" na aba → OAuth `/api/instagram/oauth?messaging=1` (state `soma10msg`) → callback salva a conta + inscreve webhooks (`me/subscribed_apps?subscribed_fields=messages`) e volta ao CRM. Selo "✓ Conectada: @conta".
- **Envio** via `graph.instagram.com/{versao}/me/messages` com o token da conta (agência OU cliente). `resolverContaIg(id)` acha a conta dona. Webhook grava `contaId` na conversa; envio resolve o token por `contaId`. Perfil do remetente (nome/@username/foto) enriquecido no webhook (uma vez), com avatar no CRM.
- Chaves `ig:conversas`/`ig:conversa:{id}`/`ig:msgs:{id}` (+ `contaId`/`foto`). Env `INSTAGRAM_VERIFY_TOKEN` (na Vercel). Webhook loga o payload p/ diagnóstico. WhatsApp continua igual (scaffold, sem número).

### 17.3 Sistema de conhecimento IA-First (Brand Playbook)
- **Brand Playbook por cliente** (`Cliente.playbook`: posicionamento, padraoCopy, criativosQueFuncionam, fazer/naoFazer, restricoes, observacoes, aprovado, origemUltimaEdicao). Editor `BrandPlaybook.tsx` (botão "Playbook da marca" na seção Brand Board) com **"Destilar com IA"** → rascunho → **humano aprova**. `/api/brand/playbook` (GET/PUT/POST destilar, que lê também `cliente.documentos[]`).
- **Ferramenta de leitura `consultar_brandboard`** (`assistenteTools.ts`) — busca sob demanda Brand Board + Playbook + documento de marca de um cliente; exposta no seletor de ferramentas do agente e no assistente geral.
- **Base de conhecimento no agente** (`Agente.conhecimento[]`): upload de PDF/DOCX/imagens no modal de `Agentes.tsx`; extração compartilhada em `lib/extrairTexto.ts` (DOCX via `mammoth` — instalado; PDF/imagens via Claude multimodal base64). Texto injetado no system prompt do agente. `/api/agentes/extrair`.
- Detalhes vivos em [[conhecimento-ia-first]].

### 17.4 Aprovação de criativos — LINK ÚNICO por cliente (fluxo pelo Planner, NÃO pela Esteira)
- **Fluxo oficial:** Planner → "Nova postagem" → **3ª ação "Enviar para aprovação"** (ao lado de Rascunho e Publicar/Agendar). Salva o post como `aguardando_aprovacao` e copia o **link ÚNICO do cliente**. (Vale no Planner da agência E no do portal `app/cliente/[clienteId]/planner`.)
- **Link único por cliente** `/aprovacoes/[token]` (público, sem login): `cliente.aprovacaoToken` + mapa reverso `aprovtoken:{token}→clienteId`. Lista TODOS os posts `aguardando_aprovacao` do cliente, cada um em **preview estilo Instagram** (avatar+@perfil, mídia nas **medidas originais** — carrossel/vídeo, ícones do feed, legenda). Ações por item: **Aprovar / Pedir ajuste / Rejeitar** (motivo obrigatório). `/api/aprovacao-link` (POST equipe gera token; GET público lista). Botão "Link de aprovação" por cliente em Config→Clientes.
- **Decisão** (`/api/decision`) autoriza por sessão-cliente, código de 6 díg OU **token do cliente**. Ao **aprovar**: enfileira em `agendados` (data futura = na hora certa; "agora" = próximo ciclo do cron) — **não publica síncrono** (evita travar o botão em vídeo). Motivo de ajuste/reprovação (`motivoReprovacao`/`anotacoes`) é **gravado e EXIBIDO** no post (preview do dashboard e do portal). Editar/excluir habilitados também para `corrigir`/`reprovado`/`aguardando_aprovacao`.
- Página pública por-post `/aprovar/[id]?c=CODIGO` continua (código na URL); a de vários é a `/aprovacoes/[token]`.

### 17.5 Correções e UX desta sessão
- **Publicação:** erro transitório do Instagram (`-1`/`2207085` "erro interno, tente novamente") agora **retenta** (era falha fatal); vale criação de container e `media_publish`.
- **Tarefas:** links (http/https) viram **clicáveis** em comentários e no histórico (`TextoComMencoes` em `GestaoTarefas.tsx`).
- **UX global:** **barras de rolagem escondidas** no sistema todo (`globals.css`, mantém a rolagem). **Rolagem dividida** sidebar × conteúdo (desktop). **Funil do CRM:** sem barra + **auto-scroll ao arrastar card** perto da borda + colunas ocupam a **altura toda** (drop em qualquer altura).
- **Assistente:** oculto em rotas públicas ([[lib/rotasPublicas]]); rebusca agentes ao abrir. **PushSetup** idem oculto em rotas públicas.

### 17.6 Novos arquivos / chaves / rotas (resumo desta fase)
- **Libs:** `instagramDM.ts`, `extrairTexto.ts`, `rotasPublicas.ts`.
- **Componentes:** `BrandPlaybook.tsx`. `CRM.tsx` (multicanal + AvatarConv), `Agentes.tsx` (upload conhecimento), `GestaoTarefas.tsx` (links), `PostComposer.tsx` (3º botão).
- **Rotas:** `/api/instagram/webhook`, `/api/crm/mensagens-instagram`, `/api/aprovacao-link`, `/api/brand/playbook`, `/api/agentes/extrair`. Páginas públicas `/privacidade`, `/termos`, `/exclusao-de-dados`, `/aprovacoes/[token]`.
- **Chaves Redis:** `ig:conversas`/`ig:conversa:{id}`/`ig:msgs:{id}`, `config:contasMensagensIg`, `aprovtoken:{token}`. Campos: `Cliente.playbook`/`aprovacaoToken`; `Agente.conhecimento[]`; `Post.motivoReprovacao`/`anotacoes` (exibidos). Env: `INSTAGRAM_VERIFY_TOKEN`. Dep nova: `mammoth`.

## 18. PRÓXIMO PROJETO — "Studio" IA-First (redesenho de Social/Briefings/Copy/Esteira) — APROVADO, a iniciar

> Plano completo e aprovado. Diagnóstico: a IA **já gera o mês inteiro** (`/api/esteira/gerar-plano`), mas a **Esteira kanban de 6 colunas** obriga o humano a empurrar cards — rebaixando estrategista a operário. Síntese: **"a IA opera a fábrica; o humano rege a orquestra"**.

**O modelo "Studio":** uma superfície por cliente = **tabela viva do mês** (linhas editáveis inline: pauta/briefing · copy · direção de criativo · formato · data · estado) + **co-piloto** conversacional. Sem colunas: estados fluem sozinhos (rascunho da IA → equipe aprova → cliente aprova via link único → publica). Reaproveita quase tudo (Post, Plano, Brand Playbook, agentes, Planner, aprovação, gerar-plano/gerar-legenda).

**Fases (começar por 0→1, em paralelo à Esteira, medindo "taxa de edição" desde o dia 1):**
- **Fase 0 (a INICIAR):** motor `gerar-plano` passa a ler o **Brand Playbook** (não só o Brand Board) + medir taxa de edição. *Prova a matéria-prima em 1 sessão.* — **NÃO iniciada** (edição foi interrompida; retomar aqui).
- **Fase 1:** `StudioMes.tsx` (tabela viva, edição inline, fluxo automático pro cliente), aba nova em **paralelo** à Esteira.
- **Fase 2:** co-piloto (nudges: `regenerar_item`/`variacoes_copy`/`ajustar_tom`/`mover_data`) + geração incremental por item + dono/"travado em quê".
- **Fase 3:** flywheel (edições + decisão do cliente + performance → destila no Playbook com aprovação; aprende de **performance real**, não só "aprovou" — evita doom-loop).
- **Fase 4:** "Surpreenda-me", campanhas, sazonalidade, guardrails de custo; aposenta a Esteira antiga só após prova.

**Pré-mortem (riscos monitorados):** rascunho medíocre (Fase 0 mede antes de escalar); doom-loop de Goodhart (aprende de performance + aprovação humana); homogeneização/"AI slop" (Playbook por cliente + taxa de edição); perda de coordenação ao matar o kanban (dono/"travado em quê"); gargalo real ser o cliente; custo de tokens; JSON monolítico frágil; dívida de 2 paradigmas (paralelo, não troca a frio).

Plano detalhado salvo em `.claude/plans/traduza-e-me-diga-gentle-mochi.md` (arquivo já removido; o essencial está aqui e na §19).

## 19. Evolução 2026-07-05 (sessão grande) — Studio construído, motor de criativos, reorg, permissões, NPS

> Tudo **deployado na `main`** (push por implementação, type-check antes de cada commit; build confirmado READY via Vercel MCP). Onde diverge de seções antigas, vale o que está aqui. **Fluxo de deploy voltou ao "caminho B"** (push direto na main — o dono cogitou validar local e desistiu na mesma sessão).

### 19.1 Studio IA-First — Fases 0 e 1 FEITAS (substitui a Esteira)
- **Fase 0:** `esteira/gerar-plano` lê o **Brand Playbook** (`cliente.playbook`) além do Brand Board (prioridade sobre o board; avisa a IA quando `aprovado=false`). Captura de dados: `Post.iaGerado` (snapshot da geração) + `Post.editadoAposIA` (posts PUT compara briefing/legenda/sugestaoImagem/textoImagem/formato vs snapshot).
- **Fase 1:** **`StudioMes.tsx`** (aba **Studio** no grupo Produção, `ABA_GRUPO='producao'`). LISTA VIVA do mês: 1 item por pauta (não tabela — grid fluido, sem scroll lateral), linha recolhida (miniatura+título+estado/formato/data) que **expande no clique** em painel largura-total editável (briefing/copy/direção + formato segmentado + data + preview). Edição inline salva no blur (dispara `editadoAposIA`). **Barra de métrica: taxa de edição.** Estados fluem por linha (rascunho→criativo→enviar→aprovado). Reusa Post/Plano/`/api/planos`/gerar-plano/aprovacao-link.
- **Seleção:** abre perguntando **"Com qual cliente vamos trabalhar hoje?"** (seletor cliente→mês, NÃO auto-seleciona o 1º); persiste em sessionStorage (refresh mantém).

### 19.2 Motor de criativos — a IA gera a IMAGEM do post (Track 1: template de marca)
- **`lib/criativoTemplates.tsx`** — 5 templates @vercel/og (`capa/dica/citacao/dado/foto`) em **1080×1350**; cores+logo do cliente; contraste automático; **fontes Poppins** em `public/fonts/*.ttf`. Template `foto` usa uma foto da marca de FUNDO + scrim + título.
- **`/api/studio/gerar-criativo`** (`maxDuration 60`): Claude é diretor de arte (escolhe template+textos, recebe até 3 ATIVOS como imagem base64), server **rasteriza via `ImageResponse`** e devolve **base64** (o **Blob store é PRIVADO** → `put` público é barrado; o cliente sobe pelo fluxo `upload()` que gera URL pública que o IG busca). **`baixarImg`** baixa imagens (logo/fundo/refs) no servidor e passa em **base64/dataUri** (og/IA não alcançam o Blob privado por URL). Log `[gerar-criativo]` p/ diagnóstico.
- **Modal "Gerar arte"** (botão "Criar arte" na linha): escolher **imagem de referência** dos ativos, **adicionar nova** (sobe no Blob + salva nos ativos) ou **sem imagem**; + campo **headline fixa** (seguida à risca). Foto explícita força o uso em qualquer template.
- **Editor de arte Nível 1** (botão "Editar arte" no preview): `Post.criativoData` guarda a receita (template/headline/subtexto/bullets/rodape/cores/fundoUrl/logoUrl). Modos `render` (re-renderiza sem IA) e `refinar` (IA ajusta textos por instrução). Modal: preview + campos editáveis + "Aplicar mudanças" + "Refinar com IA". **Nível 2 (editor visual) = FEITO (sessão 2026-07-05):** template `'livre'` (camadas absolutas no canvas 1080×1350). `lib/criativoTemplates.tsx` ganhou tipo `Camada` (texto/imagem/forma) + `renderCamada` + branch `'livre'` no `montarCriativo`. `renderSpec` (rota `gerar-criativo`) resolve URLs das camadas→dataUri e rasteriza via `modo:'render'` (reusa o pipeline). No `StudioMes.tsx`, toggle **Simples | Visual** no modal "Editar arte": canvas escalado com **arrastar** (pointer events), lista de **camadas** (reordenar/excluir), **adicionar** texto/forma/imagem-da-marca, painel de propriedades do selecionado (texto: conteúdo/tamanho/largura/peso/cor/alinhamento; imagem: L/A/raio/fit; forma: L/A/raio/cor), cor/foto de fundo. `entrarVisual()` semeia camadas a partir da receita atual. Resize por painel (drag-resize por alça = futuro). **Track 2 (foto realista por IA via Ideogram) = INTEGRADO (sessão 2026-07-05), no-op até a key:** `lib/ideogram.ts` (`ideogramConfigurado()`, `gerarFotoIdeogram(prompt, {aspectRatio/resolution})` → `POST api.ideogram.ai/generate`, modelo V_2, aspect `ASPECT_4_5`). Rota **`/api/studio/gerar-foto-ia`** (GET `{configurado}`; POST monta prompt fotográfico em inglês via Claude a partir da pauta+DNA quando não vem pronto, gera no Ideogram, baixa e devolve base64). No `StudioMes` o modal "Gerar arte" mostra o botão **"Foto realista (IA) — Ideogram"** só quando configurado. **LIGADO EM PROD (dono setou `IDEOGRAM_API_KEY` — 2026-07-05).** Ajustes pós-validação (commits desta sessão):
  - **Aspect ratio:** V_2 NÃO aceita `ASPECT_4_5` (dava `400`); trocado para **`ASPECT_3_4`** (portrait válido mais próximo; o editor visual normaliza pra 1080×1350 no render final). Se um dia precisar do 4:5 exato, usar `resolution: 'RESOLUTION_1024_1280'` (gancho em `lib/ideogram.ts`).
  - **Foto → CRIATIVO (não foto crua):** `gerarFotoIA` no `StudioMes` agora **encadeia** — Ideogram gera a foto → sobe no Blob → chama `gerar-criativo` com `template:'foto'` + `fundoUrl`=foto + headline da pauta → sai um criativo com a **mensagem do briefing + logo + marca por cima** (scrim incluso). Fallback: se a arte falhar, salva a foto pura como fundo `livre`. Custo: 1 Ideogram + 2 Claude por clique.
  - **Logo com fallback (fix `logoOk:false`):** `gerar-criativo` tentava só `cliente.logo` (URL do IG podia estar 403/expirada → criativo sem logo, "sem cara de marca"). Agora tenta `[cliente.logo, asset categoria 'logo']` e **salva a URL que funcionou** em `criativoData.logoUrl` (o re-render também acha).
  - **Editar criativo com foto abre no VISUAL:** `abrirEditor` detecta `template 'foto'/'livre'` ou `fundoUrl` e abre no editor **Visual** convertendo `foto→livre` (`seedCamadas` mantém a foto de fundo + semeia logo/headline/subtexto/assinatura como camadas + **scrim** de legibilidade). Corrige o bug "Aplicar mudanças apagava a imagem e voltava ao início" (o render de `'foto'` colapsava pra `'capa'` quando o download da foto falhava; no `'livre'` a foto de fundo é preservada). **Falta o dono:** validar o resultado final (logo aparecendo, texto legível) e ajustar posições se quiser.

### 19.3 Ativos da marca (por categoria) — `ReferenciasVisuais.tsx`
- Gerenciador de ativos na aba **Marca** (dashboard `verComoClienteId` **E** portal `/cliente/[id]/marca`, visível p/ equipe): categorias **logo/foto/elemento/icone/print/outro**, dropzone (até 20 por vez, incremental), filtro por chip, trocar categoria, remover. Salva em **`Cliente.assetsMarca[]`** (tipos `AssetMarca`/`CategoriaAsset`; migra `referenciasVisuais` legado → 'outro'). `/api/clientes` PUT persiste `assetsMarca`. Alimenta o gerador (logo+prints primeiro, multimodal).

### 19.4 Aprovação do Studio + Esteira REMOVIDA
- **Enviar ao cliente** (Studio) seta `status:'aguardando_aprovacao'` + **`etapa:'aprovacao_criativo'`** — assim aparece na tela **Aprovações do PORTAL** (que filtra por etapa) E mantém o link público. Cliente aprova via `/api/esteira/aprovar` (exige data/hora) OU `/api/decision`. **Envios feitos antes desse ajuste ficam sem a etapa (não retroagem).**
- **Esteira removida da navegação** (dashboard + portal + matriz de permissões do cliente). Arquivos `Esteira.tsx` e `/cliente/[id]/esteira` **mantidos mas inacessíveis** (não deletados). `sessionStorage 'esteira'→'studio'`. `/api/esteira/aprovar` continua (usada nas Aprovações — nome histórico).

### 19.5 Reorganização do menu (nova ordem)
Painel (topo) · Meu dia · Personal list → **Produção** (Tarefas, Studio, **Agentes de IA**, Documentos, Mapas mentais) → **Comunicação** (Inbox, Mensagens — subiu p/ acima de Estratégia) → Estratégia → Vendas → Gestão (Financeiro) → **Pessoas e Cultura** (Carga da equipe, Colaboradores, Candidaturas, Trabalhe Conosco) → **Configurações (por último)**. "Voltar" do editor/sub-account **não joga mais pro início** (guarda a aba de origem num ref `abaAntesComposer`; sub-account não força `setAba('home')`). **Documentos e Mapas agora herdam permissão de Produção** (antes abertos a todos).

### 19.6 Notificações obrigatórias + "avisar uma vez só"
- Tipos **obrigatórios** (não podem ser desligados): `tarefa_atribuida` e `mensagem_privada` (`NOTIF_OBRIGATORIOS` no catálogo; furam mute e desligamento global). `notificar()` com **janela de 60s por usuário** (`push_janela:{email}`): várias juntas → só a 1ª pinga (as demais entram no Inbox sem novo ping); obrigatórias sempre pingam. UI em Minha Conta (NotificacoesConfig) mostra obrigatórias travadas.

### 19.7 Permissões DETALHADAS (Fase 1) — por aba + por ação
- **`lib/permissoesGranular.ts`** (client-safe): `ABAS_PERM` (telas) + `ACOES_PERM` (`gerar_ia/enviar_cliente/publicar/aprovar/excluir`); `podeAbaGranular`/`podeAcaoGranular` (default liberado; só gerente/usuario afetados; admin sempre). Storage: `config:permissoesGranular` por papel + `Usuario.permissoesGranular`. `/api/permissoes-granular` (GET equipe, PUT admin). **`lib/permissoesGranularServer.ts` `bloqueiaAcao`**. UI em **Configurações → Permissões** (matriz por papel: telas + ações). Enforcement cliente: NavBtn esconde abas bloqueadas; Studio esconde gerar-IA/enviar. Enforcement servidor: gerar-criativo/gerar-plano checam `gerar_ia`. **FASE 2 PENDENTE:** override por USUÁRIO (propagar `permissoesGranular` no JWT em `lib/auth.ts` + UI no cadastro) + enforcement de servidor nas demais ações (publicar/aprovar/excluir).

### 19.8 Conversão & Retenção: saúde dos clientes + NPS
- `/api/dashboard-vendas` agrega **saúde por cliente** (status Saudável/Atenção/Risco por inatividade + renovação + NPS) e **NPS** (score geral = %promotores−%detratores; últimas respostas). `DashboardVendas.tsx` mostra as duas seções + **criar link de NPS** (mensal/trimestral) por cliente.
- **NPS:** tipo `NpsResposta` (chaves `nps`, `nps:{id}`, `cliente:{id}:nps`) + `Cliente.npsToken` + `npstoken:{token}`. **`/api/nps`** (POST equipe gera link; GET público dados; POST público resposta 0-10+comentário+período). Página pública **`/nps/[token]`** (`dynamic='force-dynamic'` por causa do `useSearchParams`).

### 19.9 Outras correções desta sessão
- **Notepads** (Personal list): `RichText` em modo **`completo`** → tópicos (bullets), lista numerada, títulos, citação, alinhamento.

### 19.10 Novos arquivos / chaves / rotas (resumo)
- **Libs:** `criativoTemplates.tsx`, `permissoesGranular.ts`, `permissoesGranularServer.ts`.
- **Componentes:** `StudioMes.tsx`, `ReferenciasVisuais.tsx`, `PermissoesGranular.tsx`, `DashboardVendas.tsx` (saúde+NPS).
- **Rotas:** `/api/studio/gerar-criativo`, `/api/permissoes-granular`, `/api/nps`. Páginas públicas `/aprovacoes/[token]` (já existia), **`/nps/[token]`**.
- **Chaves Redis:** `cliente:{id}:posts` (índice), `config:permissoesGranular`, `nps`/`nps:{id}`/`cliente:{id}:nps`, `npstoken:{token}`, `push_janela:{email}`. Campos: `Post.iaGerado`/`editadoAposIA`/`criativoGerado`/`criativoData`; `Cliente.assetsMarca`/`referenciasVisuais`/`aprovacaoToken`/`npsToken`; `Usuario.permissoesGranular`. Deps novas: **`@vercel/og`**.

### 19.11 PRÓXIMOS PASSOS (Fase 2 — abrir sessão nova por aqui)
1. ~~**Permissões Fase 2**~~ — **FEITO (sessão 2026-07-05, commit a seguir).** Override por USUÁRIO viaja no JWT (`lib/auth.ts`: authorize→jwt→session propaga `permissoesGranular`); UI `renderGranular` no cadastro/edição de colaborador (matriz ✓/— de Ações + Telas, começa no padrão do papel); persistência em `/api/usuarios` POST/PUT. `bloqueiaAcao(role, acao, permUser)` com o override nas rotas: **publicar** (`app/api/publicar`), **aprovar** (`app/api/esteira/aprovar`, no-op pro cliente), **excluir** (posts DELETE + tarefas DELETE); `gerar-plano`/`gerar-criativo` passaram a repassar o override no `gerar_ia`. **Ressalva:** override por usuário só vale após relogar (vem do JWT). `decision` intocada (só cliente/código/token).
2. ~~**Studio Track 2 (Ideogram)**~~ — **INTEGRADO (sessão 2026-07-05).** Código pronto e no-op sem credenciais (ver §19.2). **AÇÃO DO DONO:** setar `IDEOGRAM_API_KEY` na Vercel; depois validar (aspect ratio/resolução da conta, custo). O botão "Foto realista (IA)" só aparece quando configurado.
3. ~~**Editor de arte Nível 2**~~ — **FEITO (sessão 2026-07-05).** Template `'livre'` (camadas) + editor visual de arrastar/camadas no Studio (ver §19.2). Futuro opcional: drag-resize por alça no canvas (hoje resize é por painel).
4. ~~**Painel (home): conteúdo**~~ — **FEITO (sessão 2026-07-05).** `DashboardHome.tsx` (que já tinha KPIs + gráfico de metas + alertas) ganhou: **atalhos** rápidos pras abas (`onIr` → `setAba`: Studio/Tarefas/Playbook/Planner/CRM/Conversão), **Ações da semana** (tarefas + marcos vencendo ≤7d incluindo atrasados + posts aguardando aprovação — busca `/api/tarefas` e `/api/playbook` no próprio componente) e **Andamento do Playbook** (% de marcos concluídos + atrasados + lista "em andamento"). Prop nova `onIr?` no `DashboardHome` (passada em `dashboard/page.tsx`).
5. **Validar em prod:** gerar criativo com marca (ler log `[gerar-criativo]`), NPS ponta-a-ponta, permissões por papel.

## 20. Evolução 2026-07-06 — squads por cliente + guard do notepad

> Push direto na main (caminho B), type-check antes de cada commit.

### 20.1 Squad por cliente (membros direto no cliente)
- **Modelo (decidido pelo dono):** sem entidade separada — `Cliente.squad?: string[]` (e-mails dos colaboradores que atendem o cliente), **um squad por cliente**. Persistido em `/api/clientes` PUT (campo adicionado a `camposPermitidos`).
- **Atribuição:** seção **"Squad do cliente"** no form de edição do cliente (Config → Clientes → Editar), chips toggle dos colaboradores (`usuarios` com `role !== 'cliente'`). `edicaoCliente.squad` salvo via `salvarEdicaoCliente`.
- **Função — responsável padrão de tarefas:** no `TarefaModal` (`GestaoTarefas.tsx`), ao escolher o cliente, **auto-preenche o responsável com o 1º membro do squad** (só se ainda vazio — não sobrescreve escolha manual); o dropdown de responsável **agrupa** "Squad do cliente" no topo + "Outros". Tipo local `Cliente` de `dashboard/page.tsx` e `GestaoTarefas.tsx` ganharam `squad?`.
- Não há automação de notificação/filtragem por squad ainda (dono escolheu só "responsável padrão"). Futuro possível: filtro "meus clientes" no Painel.

### 20.3 Aprovação do cliente — corrigir legenda vs ajustar layout + remover criativo
- **Corrigir legenda (só o texto) → substitui e SEGUE a programação:** nas DUAS telas de aprovação (portal `app/cliente/[id]/aprovacoes` e link público `app/aprovacoes/[token]`) há botão **"Corrigir legenda"** → editor inline com a legenda atual → salvar **substitui `post.legenda` e APROVA** (segue a programação/agenda). API: `esteira/aprovar` acao **`corrigir_legenda`** (`{novaLegenda}` → overwrite + aprova a etapa: copy avança, criativo agenda pela `dataAgendada`); `decision` type **`caption`** (overwrite + trata como `approved`). Notificação avisa que a legenda foi ajustada.
- **Ajustar layout → CANCELA a programação + notifica o responsável:** o antigo "Pedir ajuste" do criativo virou **"Ajustar layout"**. `esteira/aprovar` acao `ajuste_criativo` e `decision` type `corrected` agora fazem `srem('agendados')` + `status='corrigir'` e **notificam o criador da pauta (`notificarDono`) + o `squad` do cliente** (`notificar` por e-mail do membro), além da `notificarEquipe`. (Ajuste de COPY não mexe em programação.)
- **Studio — remover só o criativo:** botão **"Remover criativo"** na coluna Criativo de cada pauta (`StudioMes.tsx > removerCriativo`) → PUT `/api/posts` limpando `imagens/criativoData/criativoGerado/thumbnail/capasVideo` — **a pauta continua**, só a arte é apagada (antes só existia excluir a pauta inteira).
- **Feedback do cliente não some ao virar rascunho:** editar um post sem data (`salvarEdicaoPost`) o move p/ `rascunho`, e o preview do dashboard só mostrava o pedido do cliente quando status era `corrigir/reprovado` → sumia. Os dados **nunca foram apagados** (o `onSubmit` do PostComposer não envia `motivoReprovacao`/`anotacoes`; o PUT faz merge e preserva). Fix: o preview do dashboard mostra `motivoReprovacao`+`anotacoes` **sempre que existirem** (sem gate de status); a linha do Studio passou a exibir também as **marcações (`anotacoes`)**, não só `ajusteCopy/ajusteCriativo/motivoReprovacao`.
- **Marcações por ponto no LINK ÚNICO** (`app/aprovacoes/[token]`): o recurso de clicar sobre o criativo e adicionar observação por ponto (pinos numerados, x/y%) — que só existia na página por-código `app/aprovar/[id]` — foi portado pro **"Ajustar layout"**. No modo ajuste a mídia fica clicável (crosshair), cada clique abre popover "o que ajustar aqui?", vira pino numerado (por slide, `img: cur`); lista de pontos + observação geral opcional; envia `annotations[]` ao `/api/decision` (type `corrected`). Salvo em `post.anotacoes` e **exibido no preview do dashboard** (lista) + e-mail. Setas do carrossel usam `stopPropagation`. **Só no link único** (portal Aprovações e página por-código ficaram como estavam).
- **Foto de perfil do cliente — CONSERTO DEFINITIVO (proxy + auto-heal):** o `cliente.logo` guardava URL do IG que expira (403 até no servidor → avatar quebrado/inicial). Novo endpoint **`/api/foto-cliente`** (`?clienteId=` ou `?token=`, público): resolve a melhor imagem no SERVIDOR na ordem `cliente.logo → ativo 'logo' → 'icone' → qualquer ativo → referência`, faz stream (bypassa hotlink do IG), **AUTO-CONSERTA** gravando em `cliente.logo` a URL permanente (Blob) quando cai num ativo, e se nada carregar devolve um **SVG com a inicial** (nunca imagem quebrada). `AvatarCliente` ganhou prop `clienteId`: logo já-Blob carrega direto, o resto passa pelo proxy (propagado nos avatares de `dashboard/page`, `DashboardHome`, `Playbook`, portal `layout`). O mockup de `/aprovacoes/[token]` usa `/api/foto-cliente?token=`. Como o proxy auto-conserta, após 1 carga o `cliente.logo` vira Blob e conserta em todo o app.

- **Checklist do ajuste + reenviar:** cada item do "Ajuste solicitado (cliente)" no preview do dashboard ganhou um **checkbox** (marca resolvido; `anotacoes[i].resolvido` e `motivoResolvido` no post, persistidos via PUT — `aplicarPatchPostPreview`/`marcarAnotacaoResolvida`). Progresso "X/N resolvidos" e strikethrough por item. **Quando tudo resolvido** e status ∈ `rascunho/corrigir/reprovado`, aparece o botão **"Tudo resolvido — Reenviar para aprovação"** (`reenviarAprovacao`: status `aguardando_aprovacao` + etapa `aprovacao_criativo` + abre o modal de compartilhamento do link). Só no preview do dashboard (Studio usa lightbox próprio).
- **Preview no FORMATO REAL do criativo:** o preview do post (dashboard) forçava `aspectRatio 4/5` + `objectFit cover` (recortava e desalinhava os pinos). Agora usa um wrapper `inline-block` que se ajusta à imagem (`maxWidth:100%`, `maxHeight:58vh`, sem recorte) — mostra o formato real e os **pinos das marcações caem no ponto exato**.
- **Ajuste do PORTAL também aparece no preview:** a condição do bloco "Ajuste solicitado" e o checklist passaram a considerar `ajusteCriativo`/`ajusteCopy` (não só `motivoReprovacao`/`anotacoes`) — antes um ajuste feito pelo portal (`esteira/aprovar`) não aparecia no preview do dashboard.
- **Marcações do cliente VISÍVEIS no preview da equipe:** o preview do post (dashboard) só mostrava o texto das `anotacoes`; agora desenha os **pinos numerados** sobre a imagem (posição `x/y%`, no slide `a.img`), com o mesmo número da lista. A lista virou clicável (leva ao slide do ponto) e mostra "· slide N" em carrossel. (Alinhamento é aproximado quando a imagem não é 4:5, pois o preview usa `objectFit:cover`.)
- **Modal de compartilhamento do link ao enviar p/ aprovação:** ao "Enviar ao cliente" (Studio) ou "Enviar para aprovação" (composer), em vez de só copiar o link num toast, abre um **modal com o link visível** + botões **Copiar / WhatsApp (`wa.me`) / Abrir / Fechar**. `StudioMes` (`linkModal`) — também no botão da linha (renomeado p/ "Compartilhar link", `copiarLink(clienteId, nome)`); `dashboard/page` (`linkAprovModal`, no fluxo `criarPost` acao `aprovacao`). O link é o `/aprovacoes/{token}` do cliente.

### 20.2 Notepad — guard ao clicar fora
- `PersonalList.tsx`: clicar no overlay do editor de notepad agora **pede confirmação** (`confirmar()` de `lib/toast`, "Sair" / "Continuar editando") em vez de fechar direto. O × e o lixeira continuam fechando/excluindo direto (a nota já tem autosave).

## 21. Evolução 2026-07-07 — solicitar conteúdo (anexo) · campanhas (relacionar) · notepads (fixar/ordenar)

> Push direto na main (caminho B), type-check antes de cada commit.

### 21.1 Solicitar conteúdo — anexos
- Portal `app/cliente/[id]/solicitar/page.tsx`: campo **"Adicionar anexo"** (multiplos, imagem/vídeo/PDF/doc/xls/txt) via fluxo `upload()` client → Blob (`solicitacoes/{clienteId}/...`); lista com remover. `/api/solicitar-briefing` aceita `anexos[]` e grava em `Tarefa.anexos` (`{nome,url,tipo}`) + conta no histórico/descrição. `/api/upload` já autoriza qualquer sessão (inclui cliente); ppt/pptx ficam fora (não estão em `TIPOS_PERMITIDOS`).

### 21.2 Campanhas — relacionar a tarefa (briefing completo + criar/vincular)
- `/api/briefings/relacionar` reescrito: a tarefa recebe o **BRIEFING COMPLETO** (`descricaoBriefing`: objetivo/plataformas/verba/período/público/oferta/observações + `conteudo`), não só o objetivo. Aceita `{ briefingId, tarefaId }` para **vincular a uma tarefa EXISTENTE** (anexa o briefing à descrição + registra atividade; barra outro cliente) ou `{ briefingId }` para **criar nova**.
- `Briefings.tsx`: botão "Relacionar a tarefa" abre **modal** com "**+ Criar tarefa nova**" OU **buscar+vincular** uma tarefa existente do mesmo cliente (`abrirRelModal` carrega `/api/tarefas` filtrando por `clienteId` e sem `tarefaPaiId`; `relacionar(tarefaId?)`).

## 23. Fase 1 — Plano modular (entitlement por cliente)

> Núcleo grátis + add-ons pagos por cliente. Push direto na main.

### 23.1 Catálogo + dado + billing
- `lib/modulos.ts` (client-safe): `MODULOS` (key/label/descricao/gratuito/valorPadrao/rota), `MODULOS_PAGOS`, `temModulo(modulos,key)` (grátis=sempre; pago=`ativo`), `totalMensalModulos()`. Núcleo grátis: **entregas, aprovacoes, solicitar**. Add-ons: **analytics(149), listening(99), marca(79), playbook(129)** (valores padrão editáveis).
- `Cliente.modulos: { [key]: { ativo?, valor?, desde? } }` — persistido em `/api/clientes` PUT (`camposPermitidos`).
- **UI admin:** seção **"Módulos & assinatura"** no form de edição do cliente (Config → Clientes): toggle por add-on + valor mensal + **total/mês** somado. `edicaoCliente.modulos`.

### 23.2 Enforcement
- **Servidor:** `lib/modulosServer.ts bloqueiaModuloCliente(role, clienteId, key)`. Rotas dos add-ons passaram a **liberar cliente COM o módulo** (antes bloqueavam cliente de vez): `analytics` (força session.clienteId + `temModulo('analytics')`), `social-listening` (idem 'listening'), `playbook` GET (idem 'playbook', escopado ao próprio). `brand/playbook` (Marca) segue **team-only** (é editor de curadoria).
- **Portal:** add-ons ganham `modulo` no `NAV_ITEMS`; o cliente vê no menu os que **contratou** (`grupoCliente` inclui `!ehEquipe && temModulo(...)`); guard de URL libera a página do add-on contratado. **Expostos ao cliente:** Analytics, Social Listening, Playbook. **`marca` fica billável mas sem visão do cliente ainda** (página é editor de equipe — construir visão read-only depois).
- **Ressalva:** as páginas de portal dos add-ons foram feitas como ferramenta da EQUIPE (sub-account) — o dado já é isolado (Fase 0), mas alguns controles de equipe podem aparecer pro cliente; **polir cada visão** é o próximo passo antes de vender de fato.

## 22. Fase 0 — Blindagem (rumo a abrir para clientes) — em andamento

> Antes de disponibilizar acesso a clientes externos + plano modular pago. Push direto na main.

### 22.1 Auditoria de isolamento multi-tenant (server-side)
- Auditoria completa das rotas `app/api/**`. **Resultado: isolamento já sólido** — `posts`/`clientes`/`analytics` forçam `clienteId = session.clienteId` p/ `role:cliente`; `social-listening`/`playbook`/`briefings`/`resumo-semanal`/`crm`/`financeiro`/`documentos`/`assistente-chat`/`usuarios`/`equipe` **bloqueiam cliente** (401). `planos` GET filtra por `sessionClienteId` **antes** do filtro de query (id alheio → conjunto vazio). Falsos-positivos descartados.
- **Único buraco real corrigido:** `app/api/colab` (busca de perfis p/ menções) não bloqueava cliente → um cliente podia usar o **token Meta de OUTRO cliente** via `?clienteId=`. Agora bloqueia `role:cliente` (401).
- **Guard de URL do portal** reforçado (§21.4): cliente em página `equipe:true` → redirect ao Início.

### 22.2 Backup automático (Redis → Blob privado)
- `lib/backup.ts`: `exportarTudo()` (clientes, usuarios, posts, tarefas, marcos, templates, despesas, candidaturas, briefings, planos, CRM, agentes, documentos, mapas, config:*, personal:*) + `salvarBackup()` → `put` em **`backups/YYYY-MM-DD.json` (access: private)**, sobrescreve o do dia, **retenção 35 diários**.
- **Cron** `/api/cron/backup` (`cronAutorizado`, diário `0 6 * * *` no `vercel.json`). **Download on-demand admin** `/api/backup` (GET admin → JSON attachment). Botão **"Baixar backup agora"** em Config → Geral (admin). Requer `BLOB_READ_WRITE_TOKEN` (já existe).
### 22.3 Sanitização XSS do conteúdo rico
- Dep nova **`isomorphic-dompurify`**. `lib/sanitize.ts` `sanitizeHtml()` (client+server, USE_PROFILES html, remove `<script>`/`<iframe>`/`<style>`/handlers on*/`javascript:`). Aplicado no **`RichText`** (sanitiza o HTML externo antes de virar `innerHTML`; conteúdo do próprio editor — `value === últimoEmit` — não re-seta, evita pulo de cursor) e na **página pública de documento** `app/doc/[token]` (`dangerouslySetInnerHTML` sanitizado). Cobre task descriptions, documentos e notepads.
### 22.4 Senha do cliente — sem texto plano (só reset)
- `Cliente.loginSenha` **não é mais persistido** (era guardado em claro só p/ re-exibir; o GET já o removia — risco sem função). No POST de cliente a senha gerada volta em `senhaGerada` (exibição única). PUT faz `delete atualizado.loginSenha` (higieniza dados antigos ao salvar). Backup (`lib/backup.ts`) também remove `loginSenha` dos clientes.
- Novo **`/api/clientes/senha` (POST admin)** = **resetar senha**: gera nova, grava só o **hash** no `Usuario`, devolve a senha 1x. Botão **"Resetar senha"** no form de edição do cliente (só se tem `loginEmail`), reusa o modal `credenciaisGeradas`. Login continua validando pelo `Usuario.senha` (bcrypt) — nada mudou pro cliente.
- **Fase 0 concluída.** (Restam melhorias opcionais: rate limiting em endpoints públicos + expiração de tokens públicos — Fase 3.)

### 21.4 Planner movido para PRODUÇÃO (agência) — sai da área do cliente
- Dashboard: `['planner','Planner']` entrou no grupo **Produção** logo após Studio; `ABA_GRUPO.planner='producao'`. A equipe acessa o Planner direto (todos os posts; filtra por cliente via `verComoClienteId`).
- Portal do cliente (`layout.tsx`): item `/planner` virou `equipe: true` (cliente não vê mais). Guard de URL reforçado: cliente que acessa página `equipe:true` (Planner/Playbook/Marca/Listening/Analytics) por URL direto é **redirecionado ao Início** (buraco pré-existente também fechado). Toggle "Planner" removido da matriz de permissões do portal.

### 21.3 Notepads — fixar (até 3) + ordenar por recente
- `PersonalList.tsx`: `Notepad.fixado`. Botão de **fixar** (pin) por nota — **máx. 3** (`toggleFixar`, toast ao exceder; não altera `atualizadoEm`). Ordenação `ordenadas`: **fixadas primeiro**, e dentro de cada grupo as **editadas mais recentemente no topo** (`atualizadoEm || criadoEm`). `/api/personal` sanitiza e persiste `fixado`.

## 24. Fase 1.5 — Visões cliente dos add-ons (2026-07-07)

> Polir o "modo cliente" dos add-ons pagos antes de vender de fato. Push direto na main (commit `e243ba5`, build READY). Servidor já estava seguro (Fase 0/1); esta fase é **UX do portal**.

### 24.1 Playbook read-only no portal
- `Playbook.tsx` ganhou prop **`somenteLeitura`**. Quando true: esconde "+ Novo marco" e desabilita excluir (`editavel = podeEditar && !somenteLeitura`, idem `excluivel`); e o **clique no marco abre um DETALHE read-only** (`MarcoDetalhe`) em vez do formulário de edição (`MarcoModal`). Empty-state também troca o texto ("assim que a estratégia for montada..."). `MarcoDetalhe` mostra categoria + badge de status + período + responsável + descrição, sem nenhum campo editável.
- Portal `app/cliente/[id]/playbook/page.tsx` calcula `ehEquipe` (admin/gerente && !viewAs) e passa `somenteLeitura={!ehEquipe}`. Servidor já bloqueava POST/PUT/DELETE de `role:cliente` (401) — isto é só a UX. Equipe (sub-account) mantém edição total.

### 24.2 Marca (Brand Board) exposta ao cliente
- `layout.tsx`: o `NAV_ITEM` `/marca` ganhou **`modulo: 'marca'`** → o cliente que **contratou** o add-on passa a ver "Marca" no menu (o guard de URL já libera add-on contratado). A página `marca/page.tsx` já tinha modo-leitura p/ não-equipe (Brand Board + documento de marca por IA).
- **Galeria de identidade visual read-only** (cliente): novo bloco em `marca/page.tsx` que lista `cliente.assetsMarca` filtrando só as categorias de identidade **logo/foto/elemento/icone** (esconde `print`/`outro`, que são referências internas). Grid de imagens clicáveis (abre em nova aba), sem dropzone/excluir. O editor de ativos (`ReferenciasVisuais`) segue **só para equipe**.

### 24.3 Analytics / Listening — tom de cliente
- Ambas ganharam **subtítulo explicativo** (o que a tela é). Analytics: empty-state amigável ("Ainda não há métricas... assim que suas redes estiverem conectadas...") no lugar do `data.error` técnico. Sem mudança de lógica/enforcement.

### 24.4 Pendências que sobraram do 1.5
- **`marca` no NAV** continua com `equipe: true` **+** `modulo: 'marca'` (a equipe vê sempre; o cliente vê se contratou) — mesma mecânica dos outros add-ons.
- Não foi construída visão de **posts/entregas por marco** no detalhe do cliente (o `MarcoDetalhe` não busca `/api/playbook/entregas` — evitei outro endpoint no portal do cliente). Se o dono quiser, dá pra expor as entregas da etapa em read-only depois.

## 25. Fase 2 — Billing: receita dos módulos no financeiro (2026-07-07)

> Plano modular vira receita recorrente de verdade. Push direto na main.

### 25.1 Config → Clientes (UI, antes do billing)
- **Card virou tile clicável → ficha em MODAL** (`app/dashboard/page.tsx`, aba `clientes`): acabou o acordeão inline (quebrava a grade). `iniciarEdicaoCliente(c)` abre um overlay `position:fixed` (cabeçalho avatar/nome/fechar · corpo rolável com Compartilhar/Conexões/Dados/Entregáveis/Contrato/Squad/Módulos/Permissões/Identidade · rodapé fixo Excluir/Cancelar/Salvar). **Bug corrigido:** `.cliente-card:hover` NÃO pode ter `transform` (viraria containing block do modal fixed e o prenderia no card) — só `box-shadow`.
- **Modo Bloco = só prévia:** tile mostra avatar + nome + selo (Cliente/Projeto interno); @handle, Brand Board, renovação e status ficam só na Lista/ficha (gate `clientesView !== 'blocos'`).
- **Módulos & assinatura mostra TODOS:** grupo "Incluído no núcleo (grátis)" (entregas/aprovações/solicitar, selo "Incluído", sem toggle) + grupo "Add-ons (opcionais)" (analytics/listening/marca/playbook, toggle + valor). Importa `MODULOS` (catálogo completo).

### 25.2 Receita dos módulos no financeiro
- **Rentabilidade.tsx (DRE):** receita recorrente por cliente = `contratoValor + totalMensalModulos(c.modulos) + avulsas`. Aplicado em: linha-cliente (`linhasCliente`), fluxo de caixa (`recorrente`), previsão de recebimentos (mensalidade por `diaVencimento`). KPI renomeado p/ **"Receita recorrente"** + linha "· R$X em módulos" (`mrrModulos`). Importa `totalMensalModulos`/`ClienteModulos`.
- **`/api/dashboard-vendas` (Conversão & Retenção):** `mensal(c) = contrato + totalMensalModulos(modulos)`; MRR, LTV e valor das renovações usam `mensal`. Números batem com o DRE.
- `/api/clientes` já expõe `modulos` (sanitização só remove tokens/senha) → o dado chega aos dois.

### 25.3 Suspensão por inadimplência — FEITO
- `Cliente.inadimplente` + `suspensoDesde` (persistidos no PUT de `/api/clientes`, `camposPermitidos`).
- **Ficha (modal, `dashboard/page.tsx`):** seção "Cobrança e acesso" com toggle vermelho suspender/reativar (grava `inadimplente` + `suspensoDesde`).
- **Lista:** selo "Suspenso" no tile (ambas as views) + chip de filtro "Suspensos".
- **Portal (`app/cliente/[id]/layout.tsx`):** cliente inadimplente E não-equipe → tela "Acesso temporariamente suspenso" + Sair; bloqueia toda a navegação. Equipe (e "visualizar como cliente") não é bloqueada da gestão.
- **Busca/filtros da lista (§25.1 cont.):** barra no topo de Config → Clientes — busca (nome/@/e-mail) + chips (Todos / A renovar ≤30d / Sem conexão / Com add-on / Suspensos).

### 25.4 Hardening server-side do suspenso — FEITO
- `lib/suspensao.ts`: `clienteSuspenso(clienteId)` + `suspensoPorToken(tipo, token)`.
- Bloqueado (403) para cliente suspenso: **`/api/posts` GET** (role cliente), **`/api/decision` POST** (cobre sessão + código 6 díg + `aprovtoken`), **`/api/esteira/aprovar` POST** (role cliente).
- Links públicos: **`/api/aprovacao-link` GET** e **`/api/status` GET** devolvem `{ suspenso:true }`; páginas `/aprovacoes/[token]` e `/status/[token]` mostram aviso amigável de suspensão.
- **MRR em risco (Financeiro):** KPI "Receita recorrente" mostra em vermelho o total mensal (contrato + módulos) dos clientes suspensos (`mrrRisco`). Receita segue no MRR total (é contratado); o "em risco" só destaca.

### 25.5 Fase 3 — Gateway Stripe (assinatura + dunning) — FEITO (scaffold)
- Dep **`stripe`** (v22). `lib/stripe.ts`: `getStripe()` + `stripeConfigurado()` (no-op sem `STRIPE_SECRET_KEY`, padrão WhatsApp/Ideogram).
- Campos `Cliente.stripeCustomerId`/`stripeSubscriptionId`/`assinaturaStatus`.
- **`/api/stripe/cobrar`**: GET `{configurado}`; POST (admin) cria/reaproveita o customer e abre um **Checkout de ASSINATURA mensal (BRL)** com o total do cliente (contrato + `totalMensalModulos`). Recorrência = cartão (PIX do Stripe é avulso).
- **`/api/stripe/webhook`** (valida assinatura por `STRIPE_WEBHOOK_SECRET`): **dunning** liga/desliga `Cliente.inadimplente` — `invoice.payment_failed`/`subscription past_due|canceled` → suspende (fecha o loop com o §25.3/25.4); `invoice.paid`/`subscription active` → reativa. `payment_failed` também notifica os admins.
- Ficha (modal, seção "Cobrança e acesso"): botão **"Cobrar via Stripe"** + status da assinatura, aparece só quando `stripeOn` (GET configurado). `cobrarStripe()` abre o checkout em nova aba.
- **AÇÃO DO DONO:** setar **`STRIPE_SECRET_KEY`** + **`STRIPE_WEBHOOK_SECRET`** na Vercel; criar o endpoint de webhook no dashboard do Stripe apontando p/ `https://approval.soma10.com.br/api/stripe/webhook` (eventos: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`). Depois, testar um checkout de ponta a ponta.

### 25.6 Fase 3 — hardening
- **Rate limiting** nos endpoints públicos — **FEITO.** `lib/rateLimit.ts` (`rateLimit`/`ipDaReq`/`checarRate`): contador por IP+rota no Redis (janela fixa, falha aberta). Limites/min: `decision` 40 · `candidaturas` 5 · `solicitar-briefing` 15 · `nps` (resposta pública) 10 · GETs por token (`aprov-link`/`status`/`doc-publico`) 60. Devolve 429 com mensagem amigável.
- **Rotação dos tokens públicos** — **PARCIAL.** Doc já tinha "Revogar" (§16.8); **link de APROVAÇÃO agora também:** `/api/aprovacao-link` POST aceita `{ rotacionar }` (apaga o `aprovtoken` atual + gera novo) e a ficha do cliente tem botão **"Revogar link"** (confirma → novo link + modal). Rotação sob demanda, sem auto-expiry (não quebra links já enviados). **FALTA (mesmo padrão):** botão de revogar para **status** (`statustoken`) e **NPS** (`npstoken`).
- **PIX recorrente nativo** (Asaas/Pagar.me/Mercado Pago) se não quiser depender de cartão.
- **Nome do produto** — dono decidiu **MANTER "Soma10 Approval"** por ora. Domínios livres se um dia revender: `regencia.app`/`orquestre.app`/`batuta.studio`/`pauta.studio`.

## 26. Aprovação do cliente — fluxo "Solicitar ajustes" consolidado + EM AJUSTE (2026-07-07)

> Dor: cada ação do cliente era one-shot ("Corrigir legenda" até aprovava) e o criativo SUMIA da tela ao pedir ajuste — cliente e agência ficavam perdidos. Push direto na main.

### 26.1 Link público (`app/aprovacoes/[token]`) + `/api/decision`
- Botões: **Aprovar · Solicitar ajustes · Rejeitar**. "Solicitar ajustes" abre UM painel acumulativo (legenda + marcações de layout por pino + observação + data/hora). **Nada é enviado até "Enviar solicitação"** (fim do envio no 1º clique). Atalho "Aprovar com esta legenda" quando só a legenda mudou.
- Ao enviar: `decision` type **`corrected`** agora aplica **`novaLegenda` + `novaData`** além das `annotations`; fica `status:'corrigir'` (NÃO aprova) e cancela a programação. O post **não some**: `/api/aprovacao-link` GET passou a incluir `status:'corrigir'` (com `status/anotacoes/ajusteCriativo`), e o card vira **EM AJUSTE** (selo + borda laranja) com **"Editar ajuste"** (reabre pré-preenchido) + "Aprovar assim mesmo".

### 26.2 Portal (`app/cliente/[id]/aprovacoes`) + `/api/esteira/aprovar`
- Paridade com o link. Botões: **Aprovar · Solicitar ajustes · Rejeitar** + painel consolidado (legenda + o-que-ajustar-no-layout em texto + data/hora; copy = legenda + observação).
- **Correção-chave no backend:** `ajuste_criativo`/`ajuste_copy` **MANTÊM a etapa** (`aprovacao_criativo`/`aprovacao_copy`) — antes viravam `'criativo'`/`'copy'` e, como a tela filtra por etapa, o item **sumia**. Agora ficam `status:'corrigir'` e VISÍVEIS (EM AJUSTE). Ajuste consolidado aplica `novaLegenda`+`novaData`+`annotations`. Banner/"Aprovar todos" contam só `status!=='corrigir'`.
- Tudo isso também alimenta o **log de solicitações** (§ logs-cliente, 30 dias).

### 26.3 Observações
- Reprovar no portal ainda passa por `ajuste_copy/criativo` com prefixo "REJEITADO:" (herdado) → aparece como EM AJUSTE com esse texto. Se quiser um estado "reprovado" separado, é um passo à parte.
- Quando a agência refaz e reenvia (Planner → "Enviar para aprovação", §21/§25), o item volta a `aguardando_aprovacao` (etapa `aprovacao_criativo`) e reaparece fresco para o cliente. Loop fechado.

## 27. Log de solicitações + fixes do Planner/Calendário (2026-07-08)

> Push direto na main. Fecha a janela do dia.

### 27.1 Log das solicitações do cliente (30 dias, descartável)
- Dor: ao editar, a notificação/solicitação do cliente sumia e ninguém reencontrava.
- `lib/logCliente.ts`: `registrarLogCliente` (grava `log:{id}` com **TTL 30d** + índices ZSET `logs:cliente` e `logs:cliente:{id}` podados por tempo) + `listarLogsCliente({clienteId,postId})`. Nunca bloqueia a ação principal.
- Disparado em: `/api/decision` (aprovar/ajuste-layout/reprovar/corrigir-legenda), `/api/esteira/aprovar` (ações do cliente no portal), `/api/solicitar-briefing` (solicitar conteúdo).
- Leitura: **`/api/logs-cliente`** GET (equipe; filtra por clienteId/postId). UI: **nova aba "Solicitações do cliente"** no grupo **Comunicação** (`LogsCliente.tsx`) — lista com busca + filtro por cliente/tipo. Registros persistem, não somem ao editar.

### 27.2 Fix: criativos aprovados sumiam do Planner
- O fix de "Enviar para aprovação" passou a marcar `etapa='aprovacao_criativo'`; o Planner só mostra posts **sem etapa ou `pronto`** (`postsPlanner`, `dashboard/page.tsx`). Aprovado pelo LINK público (`decision`) ficava preso e invisível.
- `decision` (aprovação) agora seta **`etapa='pronto'`** junto de `status:'agendado'` (igual `esteira/aprovar` já fazia). Aprovar move o post para **"Agendado"** (fila de publicação), NÃO "Aprovado" — filtrar por Agendado/Todos no Planner.
- Filtro do Planner passou a incluir posts que **já saíram da produção** (`PLANNER_STATUS_OK = aprovado/agendado/publicando/publicado/falha_publicacao`) mesmo com etapa antiga — **cura** posts que ficaram presos. Mesmo ajuste no filtro do relatório mensal.

### 27.3 Calendário do Planner: dropdown de cliente + persistência ao atualizar
- Visão **Calendário** ganhou o **seletor de cliente** (reusa `bibCliente`, compartilha com a Lista) e filtra os posts do calendário.
- **Persiste ao dar F5** (sessionStorage): `soma10_plannerView` (lista/calendário), `soma10_bibCliente` (cliente), `soma10_bibStatus` (status). A aba (`soma10_aba`) já persistia. Fica na mesma página, mesmo cliente/visão.

### 27.4 Prévia do composer no formato real 4:5
- `PostComposer.tsx`: prévia estilo Instagram do **feed** usa `aspectRatio 4/5` (era `1`); story/reel `9/16`. Vale para novo post e edição.

### 27.5 Arquivos/rotas novos desta janela
- **Libs:** `logCliente.ts`, `rateLimit.ts`, `stripe.ts`, `suspensao.ts`.
- **Componentes:** `LogsCliente.tsx`. `Rentabilidade.tsx` (MRR de módulos + em risco), `PostComposer.tsx` (4:5).
- **Rotas:** `/api/logs-cliente`, `/api/stripe/{cobrar,webhook}`. Campos: `Cliente.inadimplente/suspensoDesde/stripeCustomerId/stripeSubscriptionId/assinaturaStatus`. Chaves Redis: `log:{id}`/`logs:cliente(:{id})`, `rl:{...}`.

## 28. Robustez — Visão A (observabilidade + revogar links + rede de segurança de testes) (2026-07-08)

> **Track "SaaS robusto".** Dono escolheu a **Visão A — Agência robusta** (o sistema é da própria agência, que opera e cobra os seus clientes; NÃO é white-label multi-agência). Foco desta janela: fundação de robustez que faltava. Push direto na main (caminho B); portão de testes valida antes do deploy.

### 28.1 Observabilidade caseira (sem dependência externa)
- **`lib/erros.ts`** — `capturarErro(escopo, err, ctx?)`: grava `erro:{id}` (TTL 14d) + `LPUSH erros:log` (cap 200) + **alerta admins** (`notificarAdmins('geral', ...)`) no máx. 1x/30min por escopo (`erro_alerta:{escopo}` SET NX, anti-flood). NUNCA lança (observabilidade não derruba fluxo). `listarErros(limite)` p/ o painel.
- **`/api/health`** (público, leve) — ping do Redis; 200 se up, 503 se down. Para monitor de uptime externo (UptimeRobot/BetterStack) alertar queda.
- **`/api/sistema`** (admin) — status de cada integração (redis/blob/auth/anthropic/meta/smtp/cron/stripe/push/ideogram/whatsapp), últimos erros e o backup mais recente (`list({ prefix: 'backups/' })`).
- **`SaudeSistema.tsx`** + aba **Config → Saúde do sistema** (`abaConfig='sistema'`): selo essenciais no ar/faltando, grid de integrações (verde/vermelho/cinza), último backup, lista de erros recentes, botão Atualizar.
- **Captura ligada em 5 fluxos críticos** (só somam `capturarErro` no catch; resposta HTTP inalterada): `cron/publicar` (corpo extraído p/ `publicarAgendados()` + try de topo), `cron/backup`, `cron/automacoes`, `stripe/webhook` (catch de processamento; a validação de assinatura 400 fica de fora — é probe), `decision` (corpo extraído p/ `decidir(req)` + try de topo).

### 28.2 Revogar link também para status e NPS (fecha §25.6)
- `/api/status` POST e `/api/nps` POST aceitam **`rotacionar`**: `del` do token atual (`statustoken`/`npstoken`) + zera `statusToken`/`npsToken` antes de gerar novo — mesmo padrão do `aprovacao-link`. Link antigo para de funcionar na hora.
- UI: botão **"Revogar status"** na ficha do cliente (`dashboard/page.tsx`, `revogarLinkStatus`) ao lado de "Status público"; botão **"Revogar"** no NPS (`DashboardVendas.tsx`, `revogarLinkNps`) ao lado de "Gerar link". (Restava só isto do §25.6; agora os 3 links públicos têm revogação.)

### 28.3 Rede de segurança — testes de fumaça + PORTÃO de deploy
- Dep dev **`vitest`**. `vitest.config.ts` (include `tests/**/*.test.ts`, alias `@/`). Scripts: `test`/`test:watch`; **`build` = `vitest run && next build`** → **um teste vermelho BARRA o build da Vercel** (deploy não sobe; site fica na versão boa). Provado: exit 1 na falha, 0 no verde.
- **23 testes** cobrindo as regras onde bug silencioso dói mais (funções puras, determinísticas): **cobrança** (`lib/modulos.ts` — núcleo grátis, add-on só ativo, soma mensal, valor custom vs padrão, caso "R$0 explícito") e **permissões** (`permissoesCatalogo.podeNivel`/`normalizaNivel` + `permissoesGranular.podeAba/AcaoGranular` — hierarquia override-usuário > config-papel > padrão, admin/financeiro, retrocompat boolean).
- **Como estender:** novo `tests/*.test.ts` de função pura. Evitar teste que bata em Redis/rede/tempo/random (travaria deploy à toa).

### 28.4 PRÓXIMO (o que ainda move robustez)
- **Ação do dono:** plugar `/api/health` num monitor de uptime; setar Stripe (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`) e ver a integração ficar verde na tela Saúde do sistema.
- **Backlog de código (acabamento, não robustez):** **"reprovado de verdade"** no portal (§26.3) e **entregas/posts por marco** no `MarcoDetalhe` do cliente (§24.4).
- **Testar o restore do backup** (backup que não se testa não é backup) — próximo passo de confiabilidade.

### 28.6 Entregas por marco no portal do cliente (fecha §24.4)
- `MarcoDetalhe` (view read-only do cliente em `Playbook.tsx`) agora busca `/api/playbook/entregas?clienteId=` e renderiza `<EntregasMarco ocultarTarefas />` numa seção **"Entregas desta etapa"**: posts (miniatura + status + progresso) e campanhas vinculadas ao marco. O endpoint já força `role:cliente` a ver só o próprio.
- `EntregasMarco.tsx` ganhou prop **`ocultarTarefas`** — esconde as tarefas internas (trabalho da equipe/responsáveis) e conta o progresso só por posts. A view da equipe (`MarcoModal`) segue mostrando tudo.

### 28.5 Arquivos/rotas novos desta janela
- **Libs:** `erros.ts`. **Config:** `vitest.config.ts`, `tests/{modulos,permissoes,permissoesGranular}.test.ts`.
- **Componentes:** `SaudeSistema.tsx`. **Rotas:** `/api/health`, `/api/sistema`.
- **Chaves Redis:** `erro:{id}`, `erros:log` (lista), `erro_alerta:{escopo}` (dedupe TTL). `package.json`: dep `vitest` + scripts `test`/`build` com portão.
- **Nota de handoff:** os 4 arquivos novos do bloco de observabilidade (`erros.ts`/health/sistema/`SaudeSistema.tsx`) já existiam **untracked** de uma sessão anterior interrompida e foram **reescritos** nesta (conteúdo anterior não recuperável pelo git; versão atual completa e testada).

## 29. Ajustes pontuais — Documento, Tarefas, Mapa Mental (2026-07-08)

> Batch de melhorias pedidas pelo dono (janela do almoço). Push direto na main; portão de testes valida antes do deploy.

### 29.1 Documento (`Documentos.tsx` + `RichText.tsx`)
- **Barra de formatação flutuante:** `RichText` ganhou prop `sticky` — a barra fica fixa no topo ao rolar documentos longos. Ligada no editor de Documentos.
- **Tamanho da fonte:** `RichText` prop `fontSize` (base da área de edição; títulos escalam por `em`). Botões **A− / A+** no cabeçalho. Persistido em `Documento.fontSize` (11–28, padrão 15).
- **Atribuir a um cliente:** dropdown no cabeçalho + **logomarca fixada** (`AvatarCliente`, borda amarela). Persistido em `Documento.clienteId`/`clienteNome`; nome aparece na lista. `Documentos` recebe `clientes` do dashboard.

### 29.2 Tarefas (`GestaoTarefas.tsx` > `TarefaModal`)
- **Vincular um Documento e um Mapa Mental** à tarefa: dois seletores (após "Relacionadas", só em tarefa existente), PUT imediato. Persistido em `Tarefa.documentoId`/`mapaId` (allowlist `camposPermitidos`). *(Abrir o item vinculado direto = follow-up; hoje a associação é editável no seletor.)*

### 29.3 Mapa Mental (`MapasMentais.tsx` — reescrito)
- **Atribuir a um cliente:** dropdown no editor + logomarca fixada; badge nos cards da lista. `MapaMental.clienteId`/`clienteNome` (no GET-lista).
- **Auto-organizar:** toggle **Auto** reflui os espaços em árvore conforme os ramos são criados/removidos (só reage à estrutura, não briga com arraste). Botão **Organizar** aplica na hora.
- **Ocultar ramificação:** botão **−/+** em cada nó com filhos (colapsa/expande a sub-árvore). Posição segue o layout. `MapaNo.colapsado`; ramo colapsado conta como folha no layout.
- **Ligações não-deletáveis:** removido o clique-para-excluir conexão (excluir nó ainda remove suas ligações). Cor padrão = **#ffc00f**.
- **Fix organograma × mapa mental:** trocar de visão reorganiza limpo. Organograma = retas/cotovelo + vertical; Mapa = curvas + horizontal; Lista = indentado. Antes "mapa" mantinha as posições do organograma e só trocava a curva (bagunçava).

### 29.4 Campos/rotas desta janela
- **Campos redis:** `MapaNo.colapsado`; `MapaMental.clienteId/clienteNome`; `Documento.clienteId/clienteNome/fontSize`; `Tarefa.documentoId/mapaId`. **Rotas:** `api/mapas`, `api/documentos`, `api/tarefas` atualizadas.
- **Decisão:** cor das ligações = `#ffc00f` (dono escreveu `#ffc007`; corrigido p/ o amarelo oficial da marca).

## 30. Robustez (cont.) — observabilidade em todos os crons + testes de automação (2026-07-08)

> Continuação da fundação de robustez (§28). Push direto na main.

- **Observabilidade em TODOS os crons:** `capturarErro` agora cobre os 7 crons — antes só `publicar`/`backup`/`automacoes` (§28.1); adicionados `alertas`, `tarefas`, `crm-followup`, `resumo-semanal` (corpo extraído p/ função interna + try de topo; resposta HTTP inalterada). Qualquer job agendado que falhar sozinho agora alerta os admins e aparece em Config → Saúde do sistema.
- **Rede de testes ampliada (23 → 33):** lógica pura de **condições de automação** extraída para **`lib/automacoesCondicoes.ts`** (`condBate`/`avaliarCondicoes`/`escopoBate`; `import type` do redis = não instancia o cliente, testável). `automacoesEngine.ts` passa a importar de lá. `tests/automacoesCondicoes.test.ts` cobre operadores (preenchido/vazio/igual/diferente/contem/maior/menor), lógica todas/qualquer e escopo (selecionados/todos/excluídos). Guarda contra automação disparar errado (spam) ou não disparar.

## 31. Robustez (cont.) — DR (restaurar backup) + auditoria + monitoramento (2026-07-08)

> Os 3 próximos passos de robustez, em sequência. Push direto na main.

### 31.1 Recuperação de desastre — restaurar backup
- **`lib/backup.restaurarBackup(dados)`** — semântica de **UPSERT** (reescreve cada entidade do backup + re-indexa; **nunca apaga/flush**). Reconstrói `agendados` dos posts. Limitação: índices derivados não exportados não são reconstruídos (posts-por-cliente é lazy).
- **`/api/backup/restore` POST (admin)** — dupla trava: exige `confirmar==='RESTAURAR'`. Dois modos: **`{ pathname }`** lê o backup gerenciado do Blob no SERVIDOR (recomendado — sem o limite ~4,5MB de corpo da Vercel) ou **`{ dados }`** (arquivo enviado). Loga na auditoria; captura erro.
- **UI** em Config → Saúde do sistema (Zona de risco): dropdown dos backups diários gerenciados (primário) + upload de arquivo (alternativa) + campo de confirmação "RESTAURAR". `/api/sistema` passou a listar `backups[]`.

### 31.2 Auditoria — quem fez o quê
- **`lib/auditoria.ts`** `registrarAuditoria({ator,acao,alvo,detalhe})` (best-effort, nunca quebra) — `audit:{id}` TTL 180d + lista `auditoria:log` (cap 500). `listarAuditoria()`.
- **Instrumentado:** cliente_excluido (`clientes` DELETE), colaborador_criado/excluido (`usuarios` POST/DELETE), senha_resetada (`clientes/senha`), permissoes_papel_alteradas + permissoes_granular_alteradas (PUTs), backup_restaurado. **Visualizador** na tela Saúde do sistema (via `/api/sistema`).
- *(Suspensão por inadimplência ainda não auditada — fica de follow-up, exigiria comparar antes/depois no `clientes` PUT grande.)*

### 31.3 Monitoramento (turnkey) + ações do dono
- Tela Saúde do sistema mostra a **URL `/api/health` copiável** + instruções para plugar num monitor de uptime (UptimeRobot/BetterStack).
- **Ação do dono (sem código):** (1) criar o monitor com essa URL; (2) setar `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` na Vercel → a integração fica verde na mesma tela.

### 31.4 Arquivos desta janela
- **Libs:** `auditoria.ts`; `backup.ts` (+`restaurarBackup`). **Rotas:** `/api/backup/restore`, `/api/sistema` (+auditoria/+backups), + auditoria em clientes/usuarios/permissoes-papel/permissoes-granular/clientes-senha. **Componente:** `SaudeSistema.tsx` (auditoria + restore + monitoramento). **Chaves Redis:** `audit:{id}`, `auditoria:log`.

## 32. Fix crítico do Mapa Mental — sem sobreposição de nós (2026-07-08)

> Dono reportou nós cobrindo uns aos outros (print). Push direto na main.

- **Causa:** auto-organizar vinha DESLIGADO por padrão (nós ficavam em posições aleatórias de `addNo`) e o layout usava espaçamento FIXO, sem considerar a altura real dos nós (textos de 2+ linhas encostavam).
- **Fix (`MapasMentais.tsx`):**
  1. **Auto-organizar LIGADO por padrão** (`autoArrumar` default true) — o mapa se arruma sozinho ao adicionar/editar/colapsar e ao ABRIR (tidy imediato de mapas antigos bagunçados).
  2. **Layout mede a ALTURA REAL de cada nó** (`alturas` ref via `offsetHeight` no `ref` do nó) e é **centro-baseado**: cada folha ocupa uma faixa = altura + gap; o pai é centralizado no meio dos filhos. Garante **zero sobreposição**, mesmo com texto longo. Reflow também dispara no **blur** (fim da edição, quando a altura muda).
  3. Espaçamento entre níveis: mapa 250px (horizontal), organograma 160px (vertical); respiro entre irmãos 22px (v) / 40px (h). Múltiplas raízes empilham sem colidir (cursor compartilhado).

### 32.1 Refinamentos do Mapa Mental (2026-07-08)
- **Enquadramento ancorado no nó principal:** `ancorarNaRaiz(pos)` translada as posições para manter a 1ª raiz PARADA e ajustar o resto ao redor; `aplicarLayout` não reseta mais pan/zoom. A visão não "pula" ao reorganizar.
- **Enter em dois tempos:** 1º Enter só CONFIRMA o texto (`finalizarNo`); o 2º Enter (nó já selecionado, atalho global) cria o irmão. Tab segue criando filho.
- **Sem nós vazios:** `finalizarNo` remove o nó ao sair da edição sem texto (se for recém-criado — sem filhos e não-raiz).

### 32.2 Desfazer (Ctrl+Z) no Mapa Mental (2026-07-08)
- Pilha de histórico (`historico` ref, até 60 estados) com `snapshot()` ANTES de cada ação estrutural (criar nó via addNo, criar irmão, excluir nó/ramo, conectar) e `desfazer()` que restaura o último estado. **Ctrl+Z / Cmd+Z** (fora de campos de texto — lá vale o desfazer nativo). Após desfazer, o auto-layout re-arruma o estado restaurado.

## 33. Segurança de acesso — 2FA (TOTP) opt-in (2026-07-08)

> Verificação em 2 fatores no login. **Opt-in: DESLIGADO por padrão** — logins de quem não ativou seguem exatamente iguais (zero risco). Push direto na main.

### 33.1 Como funciona
- **TOTP** (apps: Google Authenticator/Authy/1Password) via **`otplib` v13** (API funcional async) + **`qrcode`** (QR no setup). `lib/twoFactor.ts`: `gerarSegredo`/`otpauthUrl`/`verificarCodigo` (epochTolerance 30s). Campos `Usuario.twoFactorSecret`/`twoFactorEnabled`.
- **Login em 2 passos** (`app/login`): 1) e-mail+senha → **`/api/2fa/precheck`** (verifica senha, rate-limited, diz se a conta exige 2FA); 2) se exige, revela o campo de código de 6 dígitos → `signIn` com `codigo`. `lib/auth.ts` `authorize` só exige código quando `twoFactorEnabled` (senão, inalterado).
- **Gestão** em Minha Conta (`MinhaConta.tsx`): "Ativar" → `/api/2fa` acao `setup` (segredo pendente + QR) → digitar código → acao `ativar`. "Desativar" pede um código atual. Cada usuário protege a própria conta.
- **Recuperação de lockout:** admin reseta o 2FA de um colaborador via `/api/usuarios` PUT `{ resetar2FA }` (auditado). *(UI do botão de reset = follow-up rápido.)*

### 33.2 Segurança / auditoria / testes
- Segredo TOTP **nunca vaza**: `/api/usuarios` GET e o retorno do PUT stripam `twoFactorSecret`; `meu-perfil` GET só devolve campos públicos; `/api/2fa` GET só retorna `{ativo}`.
- **Auditoria:** `2fa_ativado`/`2fa_desativado`/`2fa_resetado` (aparecem na tela Saúde do sistema).
- **Testes (35):** `tests/twoFactor.test.ts` — gera segredo/URL e valida que um código gerado passa e entradas inválidas/sem-segredo falham.

### 33.3 Arquivos
- **Libs:** `twoFactor.ts`; deps `otplib`+`qrcode`(+types). **Rotas:** `/api/2fa`, `/api/2fa/precheck`; `usuarios` PUT (resetar2FA). **Componentes:** `login/page.tsx` (2 passos), `MinhaConta.tsx` (card 2FA), `SaudeSistema.tsx` (labels). **Campos redis:** `Usuario.twoFactorSecret/twoFactorEnabled`.

## 34. LGPD — portabilidade + direito ao esquecimento (2026-07-08)

> Privacidade profissional: exportar e apagar os dados de um cliente sob demanda. Push direto na main.

- **`lib/lgpd.ts`**: `exportarCliente(id)` (read-only — reúne cliente+posts+planos+tarefas+marcos+briefings+nps+logs; **sem segredos/tokens**) e `apagarDadosCliente(id)` (cascata: apaga tudo do cliente + índices + tokens + login/notificações; **escopado só ao clienteId**, nunca toca em dados de outros).
- **`/api/clientes/lgpd` (admin):** GET `?id=` baixa o JSON (portabilidade); POST `{ id, confirmar }` apaga — **dupla trava: `confirmar` precisa ser o NOME EXATO do cliente**. Ambos auditados (`dados_exportados`/`dados_apagados`) e a exclusão captura erro.
- **UI:** componente **`LgpdCliente.tsx`** na ficha do cliente (Config → Clientes): "Exportar dados" + "Apagar todos os dados" (revela input que exige o nome exato). Rótulos na tela Saúde do sistema.
- **Nota:** a exclusão é destrutiva/irreversível; testar com cuidado quando os deploys estiverem estáveis. CRM (negócios) NÃO é apagado (entidade de vendas separada).

## 35. Segurança — anti-força-bruta no login + piso de senha (2026-07-08)

> Endurecimento do login. Push direto na main.

- **`lib/loginThrottle.ts`**: conta falhas por e-mail (`login_fail:{email}`, janela 15min, limite 8) e bloqueia temporariamente ao passar do limite. Best-effort (falha aberta — infra fora não tranca ninguém). Zera a cada login correto.
- **Ligado nos DOIS caminhos:** `lib/auth.ts` `authorize` (checa `loginBloqueado` → registra falha em senha/2FA errados → `limparFalhasLogin` no sucesso) e `/api/2fa/precheck` (mesmo contador; já era rate-limited por IP 20/min). Cobre força bruta por senha via formulário e via signIn direto.
- **Piso de senha:** `/api/usuarios` POST passa a exigir **≥ 8 caracteres** (antes não validava). `meu-perfil` já exigia ≥6.

### 33.4 2FA por E-MAIL (alternativa app-free) (2026-07-08)
- Agora o 2FA tem **dois métodos**: `app` (TOTP/QR, como antes) e **`email`** (código de 6 dígitos enviado por SMTP — sem app). `Usuario.twoFactorMethod`.
- **`lib/twoFactorEmail.ts`**: gera/guarda o código no Redis (`2fa_email:{email}`, 5 min) + envia por nodemailer. `dispararCodigoEmail`/`verificarCodigoEmail`.
- **`/api/2fa`**: `setup` aceita `metodo` (email envia o código; app gera QR); `ativar` verifica pelo método pendente; `reenviar-email`; `desativar` só com a sessão (sem código). `authorize` (auth.ts) e `precheck` verificam por método; **precheck com método email JÁ dispara o código** para a caixa.
- **Login** (`app/login`): texto e "Reenviar" quando é e-mail. **Minha Conta**: escolhe "Ativar por e-mail (sem app)" ou "Por app autenticador".
- **WhatsApp:** o mesmo padrão plugaria WhatsApp, mas depende do dono montar a conta **WhatsApp Business + credenciais Meta** (scaffold em §14.9 segue inativo). Até lá, e-mail é a via app-free.

### 33.5 INTERRUPTOR GLOBAL do 2FA — desligado por padrão (App Review Meta) (2026-07-08)
- **CRÍTICO:** o App Review da Meta usa um login de teste (e-mail+senha); se o login exigir código 2FA, o revisor não entra e a verificação FALHA. Por isso o 2FA fica **pronto mas NÃO exigido** até a Meta aprovar.
- **`lib/seguranca.ts`** `doisFatoresGlobalAtivo()` (config `config:doisFatoresGlobal`, **default false**, falha fechada = não exige). `authorize` (auth.ts) e `/api/2fa/precheck` só exigem 2FA se **global ligado E** usuário ativou. Desligado = login normal sem código (destrava também quem já tinha ativado o app).
- **Toggle admin:** `/api/seguranca` GET/PUT + botão em **Config → Saúde do sistema → "Segurança de acesso"** (com aviso vermelho: só ligar após a Meta aprovar). Auditado (`2fa_global_ligado/desligado`).
- **Minha Conta:** quando global desligado, o card mostra "preparado, mas o login ainda não exige o código". `/api/2fa` GET devolve `globalAtivo`.
- **Pós-aprovação Meta:** basta o admin ligar o toggle. Ver [[app-review-meta]].
