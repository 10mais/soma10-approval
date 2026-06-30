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
- **Usuario** `usuario:{email}`: nome, email, senha(hash), role (`admin|gerente|cliente`), cargo, foto, telefone, clienteId, **custoHora**, **salarioFixo**, **salarioVariavel** (=valorPorProjeto×qtdProjetos), **valorPorProjeto**, **qtdProjetos**.
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

**Papéis:** `admin` (gestor — vê tudo), `gerente` (sem Gestão/Pessoas e Cultura, sem notificação desses), `cliente` (portal, só o dele).

**Dashboard (agência) — `app/dashboard/page.tsx`, estado `aba`:**
- Visão geral: **Meu dia**, Painel
- Produção: Tarefas, Esteira, **Carga da equipe**
- Estratégia: Playbook, Campanhas, **Modelos**, **Automações**
- Comunicação: Inbox, Mensagens
- **Gestão (admin):** **Rentabilidade**
- **Configurações (admin):** Geral, Clientes
- **Pessoas e Cultura (admin):** Colaboradores, Candidaturas, Página Trabalhe Conosco
- "Acessar sub-account" (edição) vs "Visualizar como cliente" (read-only).

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

## 12. Pendências / próximos passos (atualizado 2026-06-30)

**Ação do dono (externo ao código):**
- **WhatsApp oficial — provisionar:** número comercial dedicado + verificação Meta Business + credenciais. Adicionar no Vercel: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`. Configurar o webhook na Meta apontando para `https://approval.soma10.com.br/api/whatsapp/webhook` (mesmo verify token, assinar campo `messages`). O scaffold backend já está pronto (ver §14).
- **Agendar cron** `/api/cron/crm-followup?secret=CRON_SECRET` no cron-job.org (1x/dia de manhã).
- Confirmar/agendar `/api/cron/resumo-semanal`.
- Adicionar chaves **VAPID** no Vercel se ainda faltar (push já funcionando): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**A construir (código):**
- **WhatsApp inbox no CRM** (ver conversas `wa:conversas`, ler `wa:msgs:{tel}`, responder via `enviarWhatsApp`, vincular conversa↔contato/negócio) + **templates HSM** (fora da janela de 24h). Fazer com as credenciais para testar de verdade.
- **CRM Fase 2 restante:** lembretes já feitos; falta refinar empresas (drill-down) se quiser.
- **Backlog antigo (2 grandes):** **Assistente de IA** (canto inferior direito, chat com Claude — SDK já existe) e **Mapas mentais** (editor de nós+conexões). Planejar antes.
- **Otimização de fundo opcional:** ZSET cronológico para limitar a LEITURA do Redis da equipe (hoje a janela de 120d filtra após o mget). Índice por cliente para TAREFAS (pulado — sem consumidor).

**Roadmap aberto / menores:** dashboard de Ads read-only (aguarda APIs Meta/Google); registro corrompido antigo a limpar; logomarca oficial em Trabalhe Conosco; dívida técnica do modo escuro (filtro de inversão — ideal um tema escuro real).

## 13. Arquivos-chave

`lib/redis.ts` (tipos/chaves) · `lib/publicar.ts` (publicação Meta) · `lib/notificacoes.ts` (`notificar`, `notificarEquipe`, **`notificarAdmins`**) · `lib/automacoes.ts` · `lib/resumoSemanal.ts` · `lib/relatorioMensal.ts` · `lib/anthropicSaldo.ts` · `lib/cache.ts` · `lib/auth.ts` · `lib/modoCliente.ts`.
Componentes: `GestaoTarefas.tsx` (+ `TarefaModal` exportado), `Esteira.tsx`, `PostComposer.tsx`, `Playbook.tsx`, `EntregasMarco.tsx`, `DashboardHome.tsx`, `Rentabilidade.tsx`, `Modelos.tsx`, `Automacoes.tsx`, `MeuDia.tsx`, `CargaEquipe.tsx`, `DriveButton.tsx`, `UploadProgress.tsx`, `Candidaturas.tsx`, `Briefings.tsx`, `MinhaConta.tsx`, `Calendar.tsx`, `ChatInterno.tsx`, `ConectarRedesModal.tsx`, `OptImg.tsx`.
**Novos (esta evolução):** `CRM.tsx` (módulo de vendas), `PersonalList.tsx`, `PushSetup.tsx`. Libs novas: `lib/webpush.ts`, `lib/whatsapp.ts`, `lib/postsIndex.ts`.

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
