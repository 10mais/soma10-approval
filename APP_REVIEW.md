# App Review — Soma10 (publicação no Instagram via API)

Guia completo para submeter o app à análise da Meta e sair do modo Desenvolvimento.
App: **Soma10** · Produto: **Instagram API (com login do Instagram)** · Empresa: **Grupo 10+**

---

## 0. Pré-requisitos (faça antes de submeter)

1. **Verificação de Negócio (Business Verification)** do "Grupo 10+"
   - Meta Business Suite → Configurações do Negócio → **Centro de Segurança** → iniciar a verificação (documento da empresa: CNPJ, comprovante, etc.). É obrigatória para Acesso Avançado.
2. **Política de Privacidade** pública (URL). Pode ser uma página simples no site da 10+ explicando como vocês usam os dados. Cadastre em: App → Configurações → Básico → "URL da Política de Privacidade".
3. **Ícone do app** e **categoria** preenchidos (App → Configurações → Básico).
4. App configurado com **"Instagram API com login do Instagram"** e o Redirect URI:
   `https://approval.soma10.com.br/api/instagram/callback`

---

## 1. Permissões a solicitar (Acesso Avançado)

No painel do app → **Casos de uso → "Gerenciar mensagens e conteúdo no Instagram" → permissões**, peça **Acesso Avançado** para:

| Permissão | Para quê |
|-----------|----------|
| `instagram_business_basic` | Ler dados básicos da conta profissional (id, username, foto) |
| `instagram_business_content_publish` | **Publicar fotos, vídeos/Reels e carrosséis** em nome do cliente |

(As de mensagens/comentários **não** são necessárias para o nosso uso — não peça, para acelerar a análise.)

---

## 2. Texto de justificativa (cole em cada permissão)

> A Meta costuma analisar em inglês. Abaixo vai PT e EN — use a EN para acelerar.

### `instagram_business_content_publish`

**PT:** "Somos uma agência de marketing (Grupo 10+). Nosso app permite que nossa equipe agende e publique conteúdo (imagens, vídeos/Reels e carrosséis) nas contas profissionais de Instagram dos nossos clientes, que nos autorizam via login do Instagram. O fluxo: o cliente conecta a conta dele, a equipe cria o post no painel, e o app publica usando a Content Publishing API. Sem essa permissão, não conseguimos publicar o conteúdo aprovado."

**EN:** "We are a marketing agency (Grupo 10+). Our app lets our team schedule and publish content (images, videos/Reels, and carousels) to our clients' Instagram professional accounts, which authorize us via Instagram Login. Flow: the client connects their account, our team creates the post in the dashboard, and the app publishes it using the Content Publishing API. Without this permission we cannot publish the approved content."

### `instagram_business_basic`

**PT:** "Usada para identificar a conta conectada (id, @usuário e foto de perfil), exibir no painel e associar as publicações à conta correta do cliente."

**EN:** "Used to identify the connected account (id, @username, profile picture), display it in the dashboard, and associate publications with the correct client account."

---

## 3. Roteiro do vídeo (screencast) — o mais importante

Grave a tela mostrando o **fluxo completo, de ponta a ponta**, sem cortes. Sugestão (2–4 min):

1. **Login no app:** abra `https://approval.soma10.com.br/login` e entre como admin.
2. **Conectar Instagram:** aba **Clientes** → num cliente → **"Conectar Instagram"** → mostre o **login do Instagram** abrindo, autorize, e volte ao painel mostrando a conta **conectada**.
3. **Criar o post:** entre no cliente → **Novo Post** → selecione **Instagram** em "Publicar em" → suba uma **imagem** + escreva uma **legenda**.
4. **Publicar:** clique em **Publicar agora** → mostre o status mudar para **Publicado**.
5. **Prova no Instagram:** abra o **app/site do Instagram** da conta e mostre **o post publicado no feed** (essa parte é decisiva — prova que a permissão é usada de verdade).
6. (Opcional) Mostre também o **Agendar** e a **publicação automática** depois.

Dicas: tela em inglês ajuda; fale/escreva o que está fazendo; mostre a URL do app.

---

## 4. Acesso de teste para os revisores

Em **App Review → Instruções**, forneça:
- **URL:** `https://approval.soma10.com.br/login`
- **Login e senha** de um usuário admin de teste (crie um na aba Usuários só para isso).
- **Passo a passo** resumido (itens 1–5 do roteiro acima).
- Observação: "A publicação ocorre em contas de Instagram profissionais reais que autorizaram via Instagram Login; o vídeo anexo demonstra o fluxo completo, incluindo o post aparecendo no feed."

---

## 5. Enviar e publicar

1. Preencha tudo acima → **Enviar para análise**.
2. Quando aprovar as permissões em **Acesso Avançado**, vá em **Publicar** → mude o app para **Live/Publicado**.
3. Pronto: a partir daí qualquer cliente conecta sem precisar virar "testador", e **outros admins** também conseguem conectar.

---

## 6. Prazo e o que fazer enquanto isso

- A análise da Meta leva tipicamente **alguns dias** (pode chegar a semanas).
- **Enquanto não aprova:** use o modo Desenvolvimento — adicione cada conta de cliente como **Testador do Instagram**, aceite o convite e conecte. A equipe já trabalha normalmente.
- Depois da aprovação, o passo de testador deixa de ser necessário.
