# App Review — Soma10 (publicação no Instagram via API)

Guia completo para submeter o app à análise da Meta e sair do modo Desenvolvimento.
App: **Soma10** · Produto: **Instagram API (com login do Instagram)** · Empresa: **Grupo 10+**

> ## ESTADO (2026-08-25) — leia antes
> - **Business Verification: CONCLUÍDA** ✅ ("GRUPO 10+ LTDA", 17/05/2026).
> - **App: PUBLICADO (Live)** ✅ · **DM funcionando ponta a ponta desde 03/07**.
> - **RESULTADO DA ANÁLISE (envio de 20/08, respondido em 20/08):** parcial.
>   - ✅ **Aprovadas:** `instagram_business_basic`, `instagram_business_manage_messages`
>     (+ `public_profile` renovada) — é exatamente o que o **Roteiro B** demonstrou.
>   - ❌ **Reprovadas:** `instagram_business_content_publish`,
>     `instagram_business_manage_insights`, `pages_manage_posts`, `pages_show_list`,
>     `pages_read_engagement` — todas com o mesmo motivo, *"screencast não alinhado com
>     detalhes do caso de uso"*, ou seja: o **Roteiro A** não convenceu.
> - **O que muda para o reenvio:** a §3.1 foi **reescrita (v2)** com a causa raiz — as
>   permissões vêm de **dois logins diferentes** (Instagram e Facebook) e o vídeo precisa
>   mostrar os **dois consentimentos**. Roteiros A1 e A2, mais legendas em inglês prontas
>   na §3.3 e a declaração de "não é server-to-server" na §3.4.
> - **Código já ajustado:** `instagram_business_manage_insights` entrou no `scopeArr` de
>   `app/api/instagram/oauth/route.ts` — antes o app **pedia a permissão na análise sem
>   nunca pedi-la no consentimento**, o que tornava o requisito da Meta impossível de
>   demonstrar (e deixava as métricas de conta do Analytics falhando caladas).
>   Conexões já existentes **não** são afetadas: o escopo só monta a URL de autorização.
> - **Grave com um CLIENTE DE TESTE** e a conta do próprio 10+ — nenhum cliente de
>   produção precisa ser desconectado ou reconectado para o reenvio.
> - ⚠️ **NÃO ligue o 2FA global** antes da aprovação (`config:doisFatoresGlobal`,
>   Config → Saúde do sistema). Segue valendo até o resultado do reenvio.

---

## 0. Pré-requisitos (faça antes de submeter)

1. ~~**Verificação de Negócio (Business Verification)**~~ — **FEITA** em 17/05/2026.
2. **Política de Privacidade** pública (URL) — feita: `/privacidade` (+ `/termos` e
   `/exclusao-de-dados`), já cadastradas no painel.
3. **Ícone do app** e **categoria** — feitos (App → Configurações → Básico).
4. App configurado com **"Instagram API com login do Instagram"** e o Redirect URI:
   `https://approval.soma10.com.br/api/instagram/callback` — feito.
5. **Webhook de DM** assinando o campo `messages`, callback
   `https://approval.soma10.com.br/api/instagram/webhook`, verify token =
   `INSTAGRAM_VERIFY_TOKEN` (Vercel) — feito e testado.

---

## 1. Permissões a solicitar (Acesso Avançado) — escopo final

**Regra aprendida:** a análise exige **demonstrar cada permissão em vídeo** → só peça o que
já está construído. Pedir o que não se demonstra reprova a rodada inteira.

| Permissão | Para quê | Status (20/08) | Onde aparece no reenvio |
|-----------|----------|----------------|--------------------------|
| `instagram_business_basic` | Identificar a conta conectada (id, @usuário, foto) | ✅ aprovada 20/08 | — |
| `instagram_business_manage_messages` | **Caixa de entrada de DM** no CRM (receber e responder) | ✅ aprovada 20/08 | — |
| `public_profile` | Básico do login | ✅ renovada 20/08 | — |
| `instagram_business_content_publish` | Publicar foto/vídeo/Reels/carrossel do cliente | ❌ reprovada | **A1** (§3.1) |
| `instagram_business_manage_insights` | Métricas da conta na tela Analytics | ❌ reprovada | **A1** passo 7 |
| `pages_show_list` | Listar as Páginas na hora de conectar | ❌ reprovada | **A2** passo 2 |
| `pages_manage_posts` | Publicar na Página do Facebook do cliente | ❌ reprovada | **A2** passo 3 |
| `pages_read_engagement` | Ler métricas/engajamento da Página | ❌ reprovada | **A2** passo 5 |

**FORA desta rodada** (não peça): `instagram_manage_*` do caminho Facebook Login (duplicado),
`ads_*`/Marketing API (função não existe no app — anúncios de agência usam System User no
Business Manager, sem review público), `whatsapp_business_*` (rodada separada, o WhatsApp do
Soma10 usa conector próprio), branded content, Public Content Access, Human Agent.

**CONFERIR NO PAINEL antes do reenvio:** o fluxo do Facebook (`app/api/meta/oauth/route.ts`)
também pede `instagram_basic`, `instagram_content_publish` e `business_management` — três
escopos que **não apareceram** na lista de "Novas solicitações" do envio de 20/08. Ou já
têm Acesso Avançado, ou ficaram de fora sem querer. Se estiverem em Acesso Padrão, o A2 vai
funcionar na sua conta (que tem papel no app) e falhar para cliente de verdade depois da
aprovação — vale conferir em App Review → Permissões e recursos e incluir no mesmo reenvio.

---

## 2. Texto de justificativa (cole em cada permissão)

> A Meta costuma analisar em inglês. Abaixo vai PT e EN — use a EN para acelerar.

### `instagram_business_content_publish`

**PT:** "Somos uma agência de marketing (Grupo 10+). Nosso app permite que nossa equipe agende e publique conteúdo (imagens, vídeos/Reels e carrosséis) nas contas profissionais de Instagram dos nossos clientes, que nos autorizam via login do Instagram. O fluxo: o cliente conecta a conta dele, a equipe cria o post no painel, e o app publica usando a Content Publishing API. Sem essa permissão, não conseguimos publicar o conteúdo aprovado."

**EN:** "We are a marketing agency (Grupo 10+). Our app lets our team schedule and publish content (images, videos/Reels, and carousels) to our clients' Instagram professional accounts, which authorize us via Instagram Login. Flow: the client connects their account, our team creates the post in the dashboard, and the app publishes it using the Content Publishing API. Without this permission we cannot publish the approved content."

### `instagram_business_basic`

**PT:** "Usada para identificar a conta conectada (id, @usuário e foto de perfil), exibir no painel e associar as publicações à conta correta do cliente."

**EN:** "Used to identify the connected account (id, @username, profile picture), display it in the dashboard, and associate publications with the correct client account."

### `instagram_business_manage_messages`

**PT:** "Somos uma agência de marketing (Grupo 10+). Nosso app tem uma caixa de entrada onde a
equipe atende, em um só lugar, as mensagens diretas recebidas nas contas profissionais de
Instagram que nos autorizam via login do Instagram. Fluxo: o dono da conta conecta pelo botão
'Conectar conta do Instagram (mensagens)'; a partir daí, cada DM recebida aparece na aba
Mensagens do nosso CRM (com nome, @usuário e foto do remetente) e o atendente responde de
dentro do painel, com a resposta entregue no Direct. Isso mantém o histórico do atendimento
junto do cadastro do lead/cliente e permite que mais de uma pessoa do time atenda sem
compartilhar a senha do Instagram. Sem essa permissão, não recebemos nem respondemos as
mensagens."

**EN:** "We are a marketing agency (Grupo 10+). Our app provides a shared inbox where our team
handles direct messages received by the Instagram professional accounts that authorize us via
Instagram Login. Flow: the account owner connects through the 'Connect Instagram account
(messages)' button; from then on, every incoming DM appears in the Messages tab of our CRM
(with the sender's name, @username and profile picture) and the agent replies from inside the
dashboard, with the reply delivered in Direct. This keeps the support history attached to the
lead/customer record and lets multiple teammates answer without sharing the Instagram
password. Without this permission we cannot receive or reply to messages."

### `instagram_business_manage_insights`

**PT:** "Exibimos as métricas da conta do cliente (alcance, impressões, seguidores, desempenho
das publicações) na tela de Analytics do painel, para o relatório mensal que entregamos a ele."

**EN:** "We display the client's account metrics (reach, impressions, followers, post
performance) on the Analytics screen of the dashboard, for the monthly report we deliver."

### `pages_manage_posts`, `pages_show_list`, `pages_read_engagement`

**PT:** "O cliente também nos autoriza a Página do Facebook dele. `pages_show_list` lista as
Páginas na hora de conectar; `pages_manage_posts` publica o mesmo conteúdo aprovado na Página;
`pages_read_engagement` lê as métricas dessa Página para o relatório."

**EN:** "Clients also authorize their Facebook Page. `pages_show_list` lists the Pages during
connection; `pages_manage_posts` publishes the approved content to the Page;
`pages_read_engagement` reads that Page's metrics for the report."

---

## 3. Roteiro do vídeo (screencast) — o mais importante

São **dois roteiros**: A (publicação) e B (mensagens). Pode ser um vídeo só, contínuo, ou um
por caso de uso. O que a Meta quer ver é **cada permissão pedida sendo usada de verdade**, com
o resultado aparecendo **dentro do Instagram** — não só dentro do nosso painel.

> **Você consegue gravar o B hoje**, mesmo sem a aprovação: em modo de desenvolvimento a DM de
> quem tem papel no app (você, como admin/testador) chega normalmente. Use um Instagram
> pessoal como se fosse o cliente escrevendo. É exatamente o que o revisor precisa ver.

### 3.1 Roteiro A — publicação (v2, refeito após a reprovação de 20/08)

> **Por que a v1 foi reprovada:** o feedback da Meta em todas as 5 permissões foi o mesmo —
> *"screencast não alinhado com detalhes do caso de uso"* — pedindo três coisas que o vídeo
> anterior não mostrou: **(1)** o fluxo de login da Meta **completo**, **(2)** um usuário
> **concedendo** a permissão (a tela de consentimento em quadro, com os escopos legíveis) e
> **(3)** a experiência completa do caso de uso.
>
> **A causa estrutural:** as permissões pedidas vêm de DOIS botões diferentes do sistema.
> `instagram_business_*` saem do login do **Instagram** (`/api/instagram/oauth`); o trio
> `pages_*` sai do login do **Facebook** (`/api/meta/oauth`). Mostrando só um botão, o
> revisor nunca vê o consentimento do outro — e reprova aquele bloco inteiro, independente
> do resto. Por isso agora são **dois segmentos**, A1 e A2.

**Regras que valem para os dois segmentos:**

- **Grave com um CLIENTE DE TESTE.** Crie um cliente novo no painel (ex.: "Soma10 Demo") e
  conecte o Instagram profissional do próprio Grupo 10+ ou uma conta secundária. Nenhum
  cliente de produção precisa ser tocado, desconectado ou reconectado.
- **Comece deslogado do Instagram/Facebook no navegador** (aba anônima). O revisor precisa
  ver a tela de login de verdade, não um "Continuar como Fulano" de sessão já aberta.
- **Não corte** entre o clique em Conectar e a volta ao painel. É justamente esse trecho
  que foi considerado ausente.
- **Deixe a tela de permissões parada 3–4 segundos**, com os escopos legíveis. Se precisar,
  dê zoom.
- **Legendas em inglês** (queimadas ou CC) — o §3.3 traz o texto pronto. A interface é
  pt-BR por decisão de produto, e o próprio feedback aceita legenda explicando os botões.
- **Mostre a URL** `approval.soma10.com.br` na barra do navegador no início.

#### A1 — Instagram Login → publicar → provar no feed → Analytics
*(cobre `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`)*

1. **Login no app:** `https://approval.soma10.com.br/login`, entre com o usuário de teste.
2. **Conectar Instagram:** aba **Clientes** → cliente de teste → **"Conectar Instagram"**.
3. **O consentimento (cena obrigatória):** mostre o **login do Instagram**, a conta sendo
   escolhida e a **tela de permissões** — segure o quadro com `instagram_business_basic`,
   `instagram_business_content_publish` e `instagram_business_manage_insights` visíveis.
   Autorize e volte ao painel com a conta **conectada** (@ e foto na tela).
4. **Criar o post:** **Novo Post** → marque **Instagram** em "Publicar em" → suba uma
   **imagem** e escreva uma **legenda**.
5. **Publicar:** **Publicar agora** → mostre o status virar **Publicado**.
6. **Prova no Instagram (decisiva):** abra o app/site do Instagram daquela conta e mostre
   **o post no feed**, com a mesma legenda.
7. **Analytics (prova do insights):** volte ao painel → **Analytics** do cliente de teste →
   mostre **alcance, visitas ao perfil e demografia** carregando. Essa tela só funciona
   porque a conta foi conectada no passo 3 com o escopo de insights — por isso ela precisa
   vir DEPOIS da conexão, no mesmo vídeo, sem corte.

#### A2 — Facebook Login → Página → publicar na Página
*(cobre `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`)*

1. Ainda no cliente de teste, use a conexão **via Página do Facebook**.
2. **O consentimento (cena obrigatória):** mostre o **login do Facebook**, depois a tela
   **"Quais Páginas você quer usar?"** — é ela que demonstra `pages_show_list`. Selecione a
   Página do 10+, siga para a tela de permissões e segure o quadro com `pages_manage_posts`
   e `pages_read_engagement` legíveis. Autorize e volte ao painel.
3. **Publicar na Página:** **Novo Post** → marque **Facebook** em "Publicar em" → imagem +
   legenda → **Publicar agora** → status **Publicado**.
4. **Prova no Facebook (decisiva):** abra a Página no Facebook e mostre **a publicação
   no feed dela**.
5. **Engajamento:** volte ao **Analytics** e mostre os números da Página carregando
   (`pages_read_engagement`).

### 3.2 Roteiro B — mensagens (DM)
*(cobre `instagram_business_manage_messages` — **JÁ APROVADO em 20/08**; regrave só se a Meta pedir de novo)*

Grave **os dois lados**: metade da tela o painel, a outra o celular/Instagram. Sem mostrar a
DM saindo e chegando no Direct, a permissão é reprovada.

1. **Conectar a conta:** no painel, **CRM → Mensagens → aba Instagram** →
   **"Conectar conta do Instagram (mensagens)"** → mostre o login do Instagram abrindo, a
   tela de permissões (com as de mensagens listadas), autorize e volte ao painel com a conta
   conectada.
2. **Chega a DM:** de OUTRO Instagram (pode ser o seu pessoal, no papel de cliente), mande uma
   mensagem para a conta conectada. Mostre o texto sendo enviado no app do Instagram.
3. **Aparece no CRM:** volte ao painel e mostre a conversa surgindo na aba Instagram, **com
   nome, @usuário e foto** do remetente (isso demonstra o `instagram_business_basic` junto).
4. **Responder:** escreva a resposta **dentro do painel** e envie.
5. **Prova no Instagram:** volte ao app do Instagram do "cliente" e mostre **a resposta
   chegando no Direct**. Esta é a cena decisiva.
6. **Por que existe:** mostre a conversa vinculada ao contato do CRM ("Vincular contato") —
   deixa claro o propósito: atendimento com histórico, sem compartilhar a senha do Instagram.

Dicas: tela em inglês ajuda; narre o que está fazendo; mostre a URL do app; sem cortes.

### 3.3 Legendas em inglês (cole na edição)

Uma legenda por cena, na ordem. São as frases que o revisor precisa ler para casar o vídeo
com o caso de uso descrito no envio:

```
1  This is Soma10, a social media management tool for marketing agencies.
2  The agency logs in to its own account at approval.soma10.com.br.
3  Each client of the agency is a separate profile inside the system.
4  The agency clicks "Connect Instagram" to link the client's professional account.
5  This is the Instagram login flow — the client signs in with their own credentials.
6  The client grants the app permission to read the account, publish content and read insights.
7  The account is now connected. The username and profile picture come from instagram_business_basic.
8  The agency creates a post: uploads the image and writes the caption.
9  "Publish now" sends the post to the Instagram Graph API using instagram_business_content_publish.
10 The status changes to "Published".
11 Here is the same post live on the client's Instagram feed.
12 The Analytics screen shows reach, profile views and audience demographics.
13 These metrics come from the account's insights, granted as instagram_business_manage_insights.
14 Now the Facebook Page flow, used by clients who also publish on Facebook.
15 This is the Facebook login flow.
16 The client chooses which Page the agency may manage — this requires pages_show_list.
17 The client grants permission to publish and to read the Page's engagement.
18 The agency publishes to the Page using pages_manage_posts.
19 Here is the post live on the Facebook Page.
20 Page engagement metrics are read with pages_read_engagement.
21 Every account is connected by its owner and can be disconnected at any time.
```

### 3.4 Observação para o campo de instruções do envio

O feedback pede que, se o app for servidor-a-servidor ou usar System User token, isso seja
declarado. **Não é o caso** — e vale dizer isso explicitamente:

> Soma10 is not a server-to-server integration and does not use a System User token for the
> reviewed use cases. Every connected account is authorized by its owner through the
> front-end Meta login flow, which is fully visible in the screencast (Instagram Login for
> the instagram_business_* permissions and Facebook Login for the pages_* permissions).
> Tokens are stored per client and can be revoked by disconnecting the account in the panel.

---

## 4. Acesso de teste para os revisores

Em **App Review → Instruções**, forneça:
- **URL:** `https://approval.soma10.com.br/login`
- **Login e senha** de um usuário admin de teste (crie um na aba Colaboradores só para isso).
- **Passo a passo** resumido dos roteiros A e B.
- ⚠️ **Confira antes de enviar:** o **2FA global tem que estar DESLIGADO** (Config → Saúde do
  sistema → Segurança de acesso). Se estiver ligado, o revisor recebe pedido de código, não
  entra e reprova. Ligue depois da aprovação.
- Observação sugerida: "A publicação ocorre em contas de Instagram profissionais reais que
  autorizaram via Instagram Login; o vídeo anexo demonstra o fluxo completo, incluindo o post
  aparecendo no feed. Para as mensagens, o app é uma caixa de entrada compartilhada: o vídeo
  mostra a DM chegando no painel e a resposta sendo entregue no Direct."

---

## 5. Enviar e publicar

1. Preencha tudo acima → **Enviar para análise**.
2. O app **já está Live** — o passo antigo de "mudar para Publicado" está feito.
3. Aprovadas as permissões em **Acesso Avançado**: qualquer cliente conecta sem virar
   "testador", **outros admins** conectam, e **a DM de qualquer pessoa** passa a chegar no CRM
   (é isso que destrava a caixa de entrada de verdade).
4. Depois da aprovação: ligue o **2FA global** (Config → Saúde do sistema).

---

## 6. Prazo e o que fazer enquanto isso

- A análise da Meta leva tipicamente **alguns dias** (pode chegar a semanas).
- **Enquanto não aprova:** só interage quem tem **papel no app**. Para publicação, adicione a
  conta do cliente como **Testador do Instagram**; para DM, a mensagem de quem tem papel
  (você) chega normalmente — a de seguidor comum, não.
- Depois da aprovação, o passo de testador deixa de ser necessário.

### Vincular um cliente novo como Testador do Instagram (passo a passo)

São DOIS lugares diferentes — o convite não vale até o cliente aceitar:

1. **Você (admin) convida** — painel do app, aba de funções:
   `https://developers.facebook.com/apps/1687925802347345/roles/roles/`
   → seção **Testadores do Instagram** → Adicionar → digitar o **@ do cliente**.
2. **O cliente aceita** — DENTRO do Instagram dele, link direto (o caminho pelo
   menu Configurações → Apps e sites às vezes NÃO aparece; use o link):
   `https://www.instagram.com/accounts/manage_access/`
3. Só depois do aceite, conecte no Soma10 pelo botão **Instagram** (caminho de
   cota barata, ~3 chamadas; ver §custo de conexão). Conectar antes do aceite
   faz o OAuth do cliente falhar (a conta ainda não tem papel no app).

---

## 7. Depois da aprovação — o que fica esperando por ela (código)

Pedidos do dono (2026-07-16) que **dependem** do Acesso Avançado para serem construídos com
teste real:
- **Busca no histórico das conversas do IG** — `CANAL_CFG.instagram` não tem `buscar`
  (o WhatsApp tem, `/api/crm/mensagens?busca=`). Espelhar. *Não depende de dado novo — dá para
  fazer antes, se quiser.*
- **Anexos, vídeos, reels, posts** — o webhook (`app/api/instagram/webhook`) só guarda texto
  hoje. Capturar mídia espelhando o WhatsApp (baixar → Blob → proxy autenticado; ver §38.4 do
  CONTEXTO-TECNICO: gravar a mensagem ANTES de baixar a mídia).
- **Abas Principal / Pedidos / Geral** — são **pastas do Instagram** e **não vêm no webhook**:
  exigem ler o endpoint de conversas da Graph API (`folder`), que só responde com a permissão
  aprovada. É o único dos três que não dá para construir às cegas.
