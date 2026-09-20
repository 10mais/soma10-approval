# App Review — Soma10 (publicação no Instagram via API)

Guia completo para submeter o app à análise da Meta e sair do modo Desenvolvimento.
App: **Soma10** · Produto: **Instagram API (com login do Instagram)** · Empresa: **Grupo 10+**

> ## ESTADO (2026-09-20) — leia antes
> - **3ª reprovação em 14/09** (envio de 04/09, roteiro v2 A1+A2): as mesmas 5 permissões,
>   o mesmo texto genérico da Política 1.6. O revisor listou: login completo da Meta, o
>   usuário concedendo a permissão, a experiência completa do caso de uso, **interface em
>   INGLÊS com dicas de ferramenta**, e declarar se é servidor-a-servidor.
> - **Reenvio v3 (§3.1):** UM vídeo por grupo de permissão, take único, janela anônima
>   começando deslogado, painel e CONTA da Meta em inglês, narração dizendo o nome da
>   permissão no consentimento e no uso. Tabela cena a cena pronta, e as instruções do
>   envio por grupo na §3.4-v3.
> - Aprovadas e fora desta rodada: `instagram_business_basic`,
>   `instagram_business_manage_messages`, `public_profile`.
>
> ## ESTADO (2026-08-25) — histórico
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

### 3.1 Roteiro v3 (setembro/2026) — UM VÍDEO POR GRUPO, sem corte, interface em INGLÊS

> **Por que a v2 foi reprovada (14/09, envio de 04/09):** as mesmas 5 permissões, com o mesmo
> texto genérico da Política 1.6. O que o revisor listou desta vez, item por item: **(1)** o
> fluxo de login da Meta completo; **(2)** o usuário **concedendo** a permissão; **(3)** a
> experiência completa do caso de uso; **(4)** boas práticas de gravação — **interface em
> INGLÊS**, legendas e dicas de ferramenta explicando cada botão; **(5)** declarar se é
> servidor-a-servidor.
>
> Duas reprovações com texto idêntico dizem que o problema é o FORMATO do vídeo, não o
> produto. O item (4) nunca foi atendido: os dois vídeos anteriores tinham a interface em
> português com legenda em inglês por cima. A v3 muda três coisas: **interface em inglês de
> verdade**, **um vídeo por grupo de permissão** (o revisor avalia permissão por permissão) e
> **narração dizendo o nome da permissão** no momento em que ela é concedida e no momento em
> que é usada.

#### Regras dos dois vídeos (o que reprovou antes)

- **Tudo em inglês na tela.** Três ajustes, feitos ANTES de gravar:
  1. Chrome com idioma **English** (Configurações → Idiomas → English no topo → reiniciar).
  2. No painel do Soma10, botão direito → **"Translate to English"**. A interface é pt-BR por
     decisão de produto; traduzida pelo navegador, o revisor lê cada botão.
  3. **A conta de teste do Instagram e do Facebook em inglês** (Instagram: Settings → Language
     → English; Facebook: Settings → Language). É isso que faz a **tela de consentimento** sair
     em inglês — é a tela que o revisor mais olha, e ela segue o idioma da CONTA, não o do app.
- **Um take só, sem corte nenhum.** Do login até a prova na rede. Corte = "não alinhado".
- **Comece deslogado de tudo** em janela anônima: deslogado da Meta E do Soma10.
- **Passe o mouse sobre o botão antes de clicar** e espere a dica aparecer. O feedback pede
  "dicas de ferramenta explicando os botões" — é literalmente isso.
- **Fale/legende o nome da permissão** duas vezes: quando ela aparece na tela de consentimento
  e quando o resultado dela aparece na tela. Ex.: *"the client is granting
  instagram_business_content_publish"* … *"this post was published using
  instagram_business_content_publish"*.
- **Segure a tela de consentimento 4 segundos**, com zoom se a lista estiver pequena.
- **Mostre a barra de endereço** (`approval.soma10.com.br`) no começo.
- **Termine dentro da rede social**: o post no feed do Instagram / na Página do Facebook.
- **Cliente de teste** ("Soma10 Demo" + Instagram profissional do próprio 10+). Nenhum cliente
  de produção é tocado.
- 2 a 4 minutos cada, `.mp4` H.264, menos de 1 GB, subido em **janela anônima** (o uploader do
  painel dá "Ocorreu um erro" em janela normal — ver CONTEXTO-TECNICO.md:392).

#### 3.1-A `pages_manage_posts` — folha de gravação (envio individual, 20/09)

Dono, 20/09: "quero fazer agora um por um, comece com esse". Este bloco é o vídeo desta
permissão SOZINHA. Um vídeo, um take, 2 a 3 minutos. As regras gerais do §3.1 valem todas
(inglês, sem corte, janela anônima, dica do botão, consentimento parado 4s).

**O caso de uso em uma frase (é isto que o vídeo tem que provar):** a agência publica na
Página do Facebook do cliente o conteúdo que o cliente aprovou, usando a autorização que o
próprio dono da Página deu no login do Facebook.

##### Antes de gravar

1. Cliente de teste **"Soma10 Demo"** existe e está **sem Facebook conectado** (card do
   cliente → Conexões → se houver "Facebook", clique em desconectar).
2. Página do Facebook de teste do 10+ existe, e a conta que vai logar é **admin dela**.
3. **Conta do Facebook com idioma English** (Settings → Language → English). É ela que faz a
   tela de consentimento sair em inglês.
4. **Chrome em inglês** e **janela anônima**; no painel, botão direito → *Translate to English*.
5. Imagem e legenda do post prontas na área de trabalho.
6. Notificações do sistema desligadas; nada de e-mail/WhatsApp aparecendo na tela.
7. App **Live** e 2FA global **desligado**.

##### O take, momento a momento (fala em inglês entre aspas)

| Tempo | O que você faz na tela | O que você fala / a legenda |
|---|---|---|
| 0:00 | Janela anônima em `approval.soma10.com.br`, barra de endereço visível | "This is Soma10, a social media management tool used by marketing agencies to publish content for their clients." |
| 0:10 | Login da agência (usuário e senha), entra no painel | "The agency signs in to its own Soma10 account." |
| 0:20 | Aba **Clients** → abre o card de **Soma10 Demo** → seção **Connections** mostrando que não há Página | "This is one of the agency's clients. No Facebook Page is connected to this client yet." |
| 0:35 | **Mouse parado sobre "Connect Facebook"** até a dica aparecer; então clica | "To publish on this client's Page, the agency clicks Connect Facebook. This starts the Facebook Login flow." |
| 0:45 | **Tela de login do Facebook**: digita e-mail e senha da conta dona da Página | "This is the Facebook login. The Page owner signs in with their own credentials — the agency never has the client's password." |
| 1:05 | **Escolha de Páginas** ("Which Pages do you want to use?"), parado 4s, seleciona a Página | "The Page owner chooses which Page the agency may manage." |
| 1:20 | **Tela de permissões**, parada 4s, com zoom na linha de publicar | "Here the Page owner is granting **pages_manage_posts**: permission for Soma10 to create posts on this Page." |
| 1:35 | Volta ao painel com a Página conectada no card do cliente | "The Page is now connected to this client's profile inside Soma10." |
| 1:45 | **New post**: sobe a imagem, escreve a legenda, marca **Facebook** em "Publish to" | "The agency creates the client's post: image and caption, with the Facebook Page as the destination." |
| 2:05 | **Mouse parado sobre "Publish now"** até a dica aparecer; clica | "Publish now sends this post to the Page through the Graph API, using **pages_manage_posts**. This is the only permission that allows it." |
| 2:15 | Status vira **Published** no painel | "Soma10 confirms the post was published." |
| 2:25 | **Abre a Página no Facebook** (nova aba, mesma janela) e mostra o post no feed dela | "And here is the same post live on the client's Facebook Page — created by Soma10 with pages_manage_posts." |
| 2:40 | Volta ao painel, card do cliente, mostra o botão de desconectar | "The Page owner authorizes this connection and can disconnect it at any time, which revokes the access." |

Se travar em alguma etapa, **não corte**: respire e siga. Vídeo com corte foi reprovado duas
vezes.

##### Justificativa da permissão (cole no campo dela, em inglês)

> Soma10 is a social media management tool for marketing agencies. Each agency client is a
> separate profile inside the panel, and the client's Facebook Page is connected by its own
> owner through Facebook Login.
>
> pages_manage_posts is used for one thing: publishing the content the client approved to that
> client's Facebook Page. The agency writes the caption and uploads the image in Soma10, the
> client approves it, and Soma10 creates the post on the Page — immediately or at the scheduled
> time chosen by the agency. Without this permission the agency would have to share the Page
> password or post manually, which is exactly what this product exists to avoid.
>
> In the screencast: the Page owner signs in with Facebook Login, chooses the Page and grants
> pages_manage_posts; the agency then creates a post and publishes it, and the same post is
> shown live on the Facebook Page.

##### Instruções para o analista (cole no campo de instruções)

> Test account for the panel: revisor.meta@grupo10mais.com.br (password in the submission
> form). There is no paywall and no geographic restriction.
>
> How to reproduce: sign in, open the Clients tab, open a client profile, click "Connect
> Facebook" (Facebook Login), select a Page and grant the permissions, then open "New post",
> upload an image, write a caption, select the Facebook Page as the destination and click
> "Publish now". The post appears on the Page.
>
> Soma10 is not a server-to-server integration and does not use a System User token. Every Page
> token comes from the front-end Facebook Login consent shown in the screencast. Scheduled
> publishing runs later with that same user access token, and disconnecting the Page in the
> panel revokes it.
>
> The panel interface is Portuguese by product decision; in the screencast it is shown in
> English (browser translation) and the narration names the permission at the moment it is
> granted and at the moment it is used.

##### Depois de subir

- Suba o `.mp4` **em janela anônima** (o uploader do painel dá "Ocorreu um erro" na normal).
- Envie **só esta permissão** nesta rodada. As outras quatro ficam para os próximos vídeos,
  com a mesma folha (troque a permissão, a tela provada e a frase do momento do uso).
- Não ligue o 2FA global enquanto houver análise aberta.

#### VÍDEO 1 — Instagram: publicar e medir
*(sobe em `instagram_business_content_publish` e `instagram_business_manage_insights`)*

| # | O que aparece na tela | O que a narração/legenda diz |
|---|---|---|
| 1 | Janela anônima, `approval.soma10.com.br`, tela de login do Soma10 | "Soma10 is a social media management tool used by marketing agencies to run their clients' accounts." |
| 2 | Login da agência | "The agency signs in to its own Soma10 account." |
| 3 | Lista de clientes → cliente "Soma10 Demo" **sem conta conectada** | "Each client of the agency is a separate profile. This client has no Instagram account connected yet." |
| 4 | Mouse parado sobre **"Connect Instagram"**, dica visível, clique | "The agency clicks Connect Instagram to start the Instagram Login flow." |
| 5 | **Login do Instagram** (usuário e senha digitados) | "This is the Instagram login. The client signs in with their own credentials." |
| 6 | **Tela de consentimento, parada 4s, com zoom** | "The client is now granting the permissions: instagram_business_basic, instagram_business_content_publish and instagram_business_manage_insights." |
| 7 | Volta ao painel: conta conectada, @ e foto | "The account is connected. The username and picture come from instagram_business_basic." |
| 8 | Novo post: imagem + legenda, **Instagram** marcado | "The agency creates a post for this client: image and caption." |
| 9 | Mouse sobre **"Publish now"**, dica visível, clique | "Publish now sends the post to the Instagram Graph API using instagram_business_content_publish." |
| 10 | Status **Published** | "The post is published." |
| 11 | **Instagram da conta**, post no feed, mesma legenda | "Here is the same post live on the client's Instagram feed. This is what instagram_business_content_publish does." |
| 12 | Volta ao painel → **Analytics** do cliente | "The agency opens the client's report." |
| 13 | Alcance, visitas ao perfil, demografia carregando | "Reach, profile views and audience demographics are read with instagram_business_manage_insights, so the agency can report results to the client." |
| 14 | Tela do cliente conectado com o botão de desconectar | "The client authorizes the connection and can disconnect it at any time." |

#### VÍDEO 2 — Facebook: escolher a Página, publicar e ler o engajamento
*(sobe em `pages_show_list`, `pages_manage_posts` e `pages_read_engagement`)*

| # | O que aparece na tela | O que a narração/legenda diz |
|---|---|---|
| 1 | Janela anônima, `approval.soma10.com.br`, login do Soma10 | "Soma10 also publishes the approved content to the client's Facebook Page." |
| 2 | Cliente de teste **sem Página conectada** | "This client has no Facebook Page connected yet." |
| 3 | Mouse sobre **"Connect Facebook"**, dica visível, clique | "The agency clicks Connect Facebook to start the Facebook Login flow." |
| 4 | **Login do Facebook** | "This is the Facebook login. The client signs in with their own credentials." |
| 5 | **"Quais Páginas você quer usar?" / "Which Pages do you want to use?"**, parada 4s | "The client chooses which Page the agency may manage. Listing the Pages of the account requires pages_show_list." |
| 6 | **Tela de permissões**, parada 4s, com zoom | "The client is now granting pages_manage_posts, to publish on the Page, and pages_read_engagement, to read that Page's metrics." |
| 7 | Volta ao painel: Página conectada pelo nome | "The Page is connected to this client's profile." |
| 8 | Novo post: imagem + legenda, **Facebook** marcado | "The agency creates a post and selects the Facebook Page as the destination." |
| 9 | Mouse sobre **"Publish now"**, clique, status **Published** | "Publish now posts to the Page using pages_manage_posts." |
| 10 | **Página no Facebook**, publicação no feed dela | "Here is the post live on the client's Facebook Page." |
| 11 | Painel → **Analytics** → números da Página | "The Page's reach and engagement are read with pages_read_engagement for the client's report." |
| 12 | Botão de desconectar a Página | "The client authorizes the Page and can disconnect it at any time." |

> **Confira antes de gravar o vídeo 2:** o login do Facebook do Soma10 pede, além do trio
> `pages_*`, também `instagram_basic`, `instagram_content_publish` e `business_management`
> (`app/api/meta/oauth/route.ts`) — o callback usa `instagram_basic` para achar o
> `instagram_business_account` da Página. Essas três **não estão na análise**, então vão
> aparecer na tela de consentimento sem estarem no envio. Se o revisor reclamar disso, a saída
> é tirá-las do `scope` do login do Facebook (a conexão do Instagram já acontece pelo login do
> Instagram) — decisão do dono, porque mexe em autenticação de produção.

#### Antes de apertar REC (checklist)

1. App **Live** no painel da Meta e 2FA global do Soma10 **desligado** (Config → Saúde do
   sistema) — o revisor entra a qualquer momento.
2. Login do revisor testado: `revisor.meta@grupo10mais.com.br`.
3. Cliente **"Soma10 Demo"** criado e **desconectado** de Instagram e Facebook (o vídeo precisa
   começar sem conexão).
4. Conta de Instagram **profissional**, vinculada à Página do Facebook do teste, e **as duas em
   inglês**.
5. Chrome em inglês, janela anônima, notificações do sistema desligadas.
6. Uma imagem e uma legenda prontas para o post (nada de arrastar arquivo procurando pasta).

---

### 3.1-b Roteiro A — publicação (v2, HISTÓRICO — reprovado em 14/09; ficou aqui pelo que ele já acertava)

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

### 3.4-v3 Instruções do envio (v3) — cole no campo de cada grupo

**Grupo Instagram** (`instagram_business_content_publish`, `instagram_business_manage_insights`):

> Soma10 is a social media management tool for marketing agencies. Each agency client is a
> separate profile inside the panel, and each client connects their own Instagram professional
> account through Instagram Login.
>
> The screencast is a single take, with no cuts, recorded in an incognito window and starting
> logged out of Instagram. It shows: the agency signing in to Soma10; the client profile with
> no account connected; the full Instagram Login flow; the consent screen where the client
> grants instagram_business_basic, instagram_business_content_publish and
> instagram_business_manage_insights; the agency creating a post with an image and a caption;
> the post being published with instagram_business_content_publish; the same post live on the
> Instagram feed; and the client's report reading reach, profile views and audience
> demographics with instagram_business_manage_insights.
>
> Soma10 is not a server-to-server integration and does not use a System User token. Every
> account is authorized by its owner in the front-end Meta login flow shown in the video.
> Publishing may also run on a schedule chosen by the agency, always with the user access token
> obtained at that consent, and the connection can be revoked in the panel at any time.
>
> Test account: [login do revisor]. There is no paywall and no geographic restriction.

**Grupo Páginas do Facebook** (`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`):

> Clients who also publish on Facebook connect their Page to the same client profile through
> Facebook Login.
>
> The screencast is a single take, with no cuts, recorded in an incognito window and starting
> logged out of Facebook. It shows: the client profile with no Page connected; the full Facebook
> Login flow; the Page picker, which is what pages_show_list provides; the consent screen where
> the client grants pages_manage_posts and pages_read_engagement; the agency publishing the
> approved content to the Page with pages_manage_posts; the post live on the Facebook Page; and
> the Page's reach and engagement being read with pages_read_engagement for the client's report.
>
> Soma10 is not a server-to-server integration and does not use a System User token. The Page
> token comes from the front-end consent shown in the video and can be revoked by disconnecting
> the Page in the panel.
>
> Test account: [login do revisor]. There is no paywall and no geographic restriction.

**Legendas/narração:** as frases prontas estão nas duas tabelas do §3.1 (uma por cena). A
interface aparece em inglês (Chrome traduzindo o painel) e a tela de consentimento também,
porque a conta de teste da Meta está com idioma English.

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
