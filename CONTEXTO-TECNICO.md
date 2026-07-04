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

## 12. Pendências / próximos passos (atualizado 2026-07-04)

> ⚠️ **LEIA §17 e §18 PRIMEIRO** — são o estado mais recente. A sessão de 2026-07-04 entregou: App Review Meta **submetido**, Instagram Direct no CRM, sistema de conhecimento IA-First (Brand Playbook), e a aprovação de criativos por **link único** (fluxo pelo Planner). **PRÓXIMO PROJETO ATIVO: o "Studio" IA-First (§18), a iniciar pela Fase 0.**
> A lista abaixo (de 2026-07-02) é histórica; itens já resolvidos: CRM Instagram Direct (feito, §17.2), Agentes Fase 3/conhecimento (feito, §17.3). Aqui fica o que RESTA do backlog antigo.

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

Plano detalhado salvo em `.claude/plans/traduza-e-me-diga-gentle-mochi.md`.
