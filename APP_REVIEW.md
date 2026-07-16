# App Review — Soma10 (publicação no Instagram via API)

Guia completo para submeter o app à análise da Meta e sair do modo Desenvolvimento.
App: **Soma10** · Produto: **Instagram API (com login do Instagram)** · Empresa: **Grupo 10+**

> ## ESTADO (2026-07-16) — leia antes
> - **Business Verification: CONCLUÍDA** ✅ ("GRUPO 10+ LTDA", 17/05/2026).
> - **App: PUBLICADO (Live)** ✅ · **DM funcionando ponta a ponta desde 03/07** (chega na
>   aba Instagram do CRM, resposta é entregue no Direct, com nome/@/foto do remetente).
> - **Falta:** gravar o screencast e **submeter**. É só isso.
> - **O escopo MUDOU:** as permissões de **mensagens ENTRAM** nesta rodada (a §1 antiga
>   mandava não pedir — valia quando o app só publicava). Lista final na **§1**.
> - Sem Acesso Avançado aprovado, DM só troca com quem tem **papel no app** (admin/testador).
>   É por isso que "chega DM" hoje e mesmo assim a submissão é necessária: cliente de
>   verdade não entra.
> - ⚠️ **NÃO ligue o 2FA global** antes da aprovação — o login de teste do revisor pediria
>   código e a análise seria reprovada (`config:doisFatoresGlobal`, Config → Saúde do sistema).

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

| Permissão | Para quê | Onde aparece no vídeo |
|-----------|----------|-----------------------|
| `instagram_business_basic` | Identificar a conta conectada (id, @usuário, foto) | Tela de conexão + avatar no CRM |
| `instagram_business_manage_messages` | **Caixa de entrada de DM** no CRM (receber e responder) | Roteiro B (§3.2) |
| `instagram_business_content_publish` | Publicar foto/vídeo/Reels/carrossel do cliente | Roteiro A (§3.1) |
| `instagram_business_manage_insights` | Métricas da conta na tela Analytics | Abrir Analytics de um cliente |
| `pages_manage_posts` | Publicar na Página do Facebook do cliente | Roteiro A, marcando Facebook |
| `pages_show_list` | Listar as Páginas na hora de conectar | Tela "Conectar redes" |
| `pages_read_engagement` | Ler métricas/engajamento da Página | Analytics |
| `public_profile` | Básico do login | Implícito |

**FORA desta rodada** (não peça): `instagram_manage_*` do caminho Facebook Login (duplicado),
`ads_*`/Marketing API (função não existe no app — anúncios de agência usam System User no
Business Manager, sem review público), `whatsapp_business_*` (rodada separada, o WhatsApp do
Soma10 usa conector próprio), branded content, Public Content Access, Human Agent.

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

### 3.1 Roteiro A — publicação
*(cobre `instagram_business_basic`, `instagram_business_content_publish`, `pages_*`)*

1. **Login no app:** abra `https://approval.soma10.com.br/login` e entre como admin.
2. **Conectar Instagram:** aba **Clientes** → num cliente → **"Conectar Instagram"** → mostre o **login do Instagram** abrindo, autorize, e volte ao painel mostrando a conta **conectada**.
3. **Criar o post:** entre no cliente → **Novo Post** → selecione **Instagram** em "Publicar em" → suba uma **imagem** + escreva uma **legenda**.
4. **Publicar:** clique em **Publicar agora** → mostre o status mudar para **Publicado**.
5. **Prova no Instagram:** abra o **app/site do Instagram** da conta e mostre **o post publicado no feed** (essa parte é decisiva — prova que a permissão é usada de verdade).
6. (Opcional) Mostre também o **Agendar** e a **publicação automática** depois.
7. **Analytics:** abra a tela **Analytics** desse cliente e mostre as métricas carregando
   (é a prova do `instagram_business_manage_insights` e do `pages_read_engagement`).

### 3.2 Roteiro B — mensagens (DM)
*(cobre `instagram_business_manage_messages` — é o roteiro NOVO desta rodada)*

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
