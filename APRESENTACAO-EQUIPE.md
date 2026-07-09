# Soma10 Approval — Guia de Apresentação para a Equipe

> Documento-base para a reunião de apresentação do sistema. Objetivo: mostrar a **espinha dorsal** — do planejamento ao sistema completo — sem aprofundar demais. Tom equilibrado: acessível para todos, com pequenos blocos **"Para os mais técnicos"** onde couber.
>
> Como usar: cada seção abaixo é aproximadamente um "bloco" da apresentação. Use os títulos como tópicos/slides e o texto como roteiro de fala. Há um **roteiro sugerido com tempos** na seção 11.

---

## 1. O que é o Soma10 Approval

**Em uma frase:** é o sistema próprio do **Grupo 10+** para gerir a agência de marketing de ponta a ponta — aprovação de conteúdo, produção, publicação em Instagram/Facebook, tarefas, CRM de vendas, financeiro, IA e portal do cliente — **substituindo o GoHighLevel**.

**O problema que resolve:** antes, a operação dependia de uma ferramenta externa (GoHighLevel) — cara, genérica e sem controle. O Soma10 Approval é **nosso**: feito sob medida para o nosso jeito de trabalhar, sem mensalidade de terceiros, e evoluindo conforme a gente precisa.

**Quem usa e como:**
- **Equipe da agência** (admin, gerente, operação, vendas) — o "dashboard".
- **Clientes** — um **portal** próprio, simplificado, onde aprovam conteúdo, acompanham entregas e pedem ajustes.

**Onde vive:** no ar, em produção, no endereço **`approval.soma10.com.br`**.

---

## 2. Como foi construído — Claude Code na prática

O sistema foi construído com **Claude Code**: uma **IA que programa**. Diferente de um chatbot que só conversa, o Claude Code **lê o código do sistema, edita os arquivos, roda testes e publica as mudanças** — trabalhando dentro do projeto de verdade.

**O modelo de trabalho (a parte importante):**
1. **A pessoa descreve a intenção** em português — "quero um botão de exportar dados do cliente", "o mapa mental está sobrepondo os nós, conserta".
2. **A IA implementa** — encontra os arquivos certos, escreve o código seguindo os padrões do projeto.
3. **Valida** — checa erros de tipo e roda uma bateria de testes automáticos.
4. **Publica** — envia a mudança e, em ~1 minuto, ela está no ar.

**Por que isso muda o jogo:** o ciclo "ideia → no ar" que levaria dias com uma equipe tradicional passa a levar **minutos**. Nesta única sessão de trabalho, por exemplo, foram entregues dezenas de melhorias — de ajustes visuais a um pilar inteiro de segurança.

> **Para os mais técnicos:** o humano atua como **arquiteto/revisor** (define o quê e valida o resultado); a IA atua como **implementadora** (escreve o código, roda `tsc`/testes, faz `commit` e `push`). O controle continua humano: nada vai pro ar sem passar pelo portão de testes (ver seção 5).

---

## 3. Conceitos técnicos básicos (glossário-relâmpago)

Para todos acompanharem o resto da apresentação:

- **Frontend** — a parte que o usuário vê e clica (as telas). *Analogia: o salão do restaurante.*
- **Backend** — a parte que processa e guarda as coisas nos bastidores. *Analogia: a cozinha.*
- **Banco de dados** — onde ficam guardadas as informações (clientes, posts, tarefas). *Analogia: o arquivo/estoque.*
- **API** — a "porta de comunicação" entre o frontend e o backend. *Analogia: o garçom que leva o pedido pra cozinha e traz o prato.*
- **Deploy** — o ato de **publicar** uma mudança, colocando-a no ar para todos.
- **Commit** — **salvar um pacote de mudanças** com uma descrição (um "ponto de restauração").
- **Build** — o processo que **monta** o sistema pronto para rodar antes de publicar.
- **Cron** — uma **tarefa automática agendada** (ex.: "todo dia às 6h, fazer backup").

---

## 4. A espinha dorsal — arquitetura em um slide

O sistema é **um único aplicativo** (não há vários sistemas separados se conversando). Componentes principais:

- **Next.js 14** — a tecnologia que roda tanto as telas quanto a lógica. *App único, sem backend separado.*
- **Upstash Redis** — o **banco de dados** (rápido, hospedado em **São Paulo**).
- **Vercel Blob** — o **armazenamento de mídia** (imagens, vídeos, anexos), privado.
- **NextAuth** — o **sistema de login** (com senhas protegidas).
- **Integrações externas** — **Meta/Instagram** (publicar posts), **Claude/IA** (gerar planos, legendas e imagens), **e-mail** (SMTP), **Stripe** (cobrança).

**Onde roda:** na **Vercel** (plataforma de hospedagem), com as funções na região **`gru1` (São Paulo)** — de propósito, perto do banco, para ser rápido.

> **Para os mais técnicos:** não há SQL. Os dados ficam no Redis por chave (`cliente:{id}`, `post:{id}`, `tarefa:{id}`…) com **índices em `sets`** para listar. A lógica de servidor vive em `app/api/**` (rotas) e `lib/**` (regras). A região `gru1` foi fixada no `vercel.json` para minimizar latência com o Upstash em `sa-east-1`.

---

## 5. Como editamos e melhoramos o sistema EM TEMPO REAL

Este é o coração do "como funciona a manutenção". O ciclo, do teclado ao ar:

```
1. Editar o código          →  a mudança desejada
2. Checagem de tipos (tsc)  →  pega erros bobos antes de tudo
3. PORTÃO DE TESTES (vitest)→  35 testes automáticos das regras críticas
4. Commit                   →  empacota a mudança com uma descrição
5. git push na "main"       →  envia pro GitHub
6. Vercel builda sozinha    →  ~1 minuto
7. NO AR em approval.soma10.com.br
```

**O "portão de testes" (o detalhe profissional):** o comando que monta o sistema é literalmente `vitest run && next build`. Tradução: **os testes rodam ANTES da publicação**. Se um teste falhar (ex.: uma regra de cobrança ou de permissão quebrou), **o deploy é barrado** e o site **continua na versão boa anterior**. Ou seja: bug em regra crítica **não chega ao cliente** — a gente vê "deploy falhou" em vez de "cliente viu erro".

**Dicas práticas para a equipe:**
- Depois de uma mudança, **Ctrl+Shift+R** no navegador para ver a versão nova (o navegador guarda cache).
- Se algo der errado no ar, a Vercel permite **reverter (rollback)** para o deploy anterior com um clique.
- Toda mudança fica **registrada** (histórico de commits) — dá para saber o que mudou, quando e por quê.

> **Para os mais técnicos:** deploy = `push` na branch `main` → auto-deploy na Vercel. Validação local: `node node_modules/typescript/bin/tsc --noEmit`. O `build` script (`package.json`) encadeia `vitest run` antes do `next build`, então um teste vermelho retorna exit≠0 e aborta o build.

---

## 6. A jornada do projeto — as etapas até aqui

O sistema **não nasceu pronto**: foi construído **incremental e medido**, em fases. A linha do tempo (resumida):

1. **MVP + Clareza** — o núcleo de aprovação de conteúdo + navegação organizada + escopo contratado × entregue.
2. **Gestão** — apontamento de horas, custo/hora, **financeiro** (DRE, fluxo de caixa).
3. **Escala** — modelos de projeto (1 clique gera marcos + tarefas), **automações** curadas.
4. **Studio IA-first** — a IA passa a **gerar o mês inteiro** de conteúdo e até a **imagem do post** (criativo com a marca do cliente). "A IA opera a fábrica; o humano rege a orquestra."
5. **Abrir para clientes + monetização modular** — portal do cliente polido, **plano modular** (núcleo grátis + add-ons pagos), cobrança (Stripe), suspensão por inadimplência.
6. **Robustez** — o sistema passa a **saber quando quebra** (observabilidade), ganha **testes automáticos**, **backup + restauração** (recuperação de desastre) e **auditoria**.
7. **Segurança** — **2FA**, proteção contra força bruta, **LGPD** (privacidade dos dados do cliente).

**Mensagem-chave:** cada fase resolveu uma dor real antes de partir para a próxima. Nada foi "grande demais para começar".

---

## 7. Segurança — o que protege o sistema

Um resumo concreto do que já está no ar:

- **2FA (verificação em 2 fatores)** — além da senha, um código no login. Por **e-mail** (sem app) ou por **app autenticador**. *Hoje está preparado mas desligado globalmente (ver observação abaixo).*
- **Anti-força-bruta** — após 8 tentativas de senha erradas, a conta é bloqueada por 15 minutos.
- **Piso de senha** — mínimo de 8 caracteres para novos colaboradores.
- **Permissões por papel** — matriz **Ver / Editar / Excluir** por módulo; o financeiro é exclusivo do admin.
- **Isolamento entre clientes** — um cliente **nunca** enxerga os dados de outro (garantido no servidor).
- **LGPD** — dá para **exportar** todos os dados de um cliente (portabilidade) e **apagar** tudo sob demanda (direito ao esquecimento), com trava de confirmação.
- **Auditoria** — registra **quem fez o quê** (excluir cliente, mudar permissão, resetar senha, restaurar backup…).
- **Backup diário + restauração** — cópia de tudo todo dia; dá para restaurar em caso de desastre.
- **Proteções extras** — sanitização contra código malicioso (XSS), limite de requisições (rate limiting), revogação de links públicos.

> ⚠️ **Observação importante (contar na reunião):** o 2FA tem um **interruptor global desligado por padrão**. Isso é **de propósito**: a **Meta/Facebook** está revisando o app (para liberar o CRM do Instagram), e o revisor usa um login de teste — se o login pedisse um código 2FA, a revisão falharia. Por isso o 2FA fica **pronto, mas dormente**, e só será ligado **depois** da aprovação da Meta.

---

## 8. Infraestrutura obrigatória (o que precisa existir — e custa)

Para o sistema funcionar, alguns serviços externos são **necessários**:

| Serviço | Para quê | Obrigatório? |
|---|---|---|
| **Vercel** (plano Pro) | Hospedagem + deploy automático | ✅ Sim |
| **Upstash Redis** | Banco de dados (pay-as-you-go) | ✅ Sim |
| **Vercel Blob** | Armazenar imagens/vídeos/anexos | ✅ Sim |
| **Domínio** (`approval.soma10.com.br`) | Endereço do sistema | ✅ Sim |
| **SMTP** (e-mail, ex. Titan) | Enviar e-mails (aprovações, códigos 2FA) | ✅ Sim |
| **Chave da Anthropic** (IA) | Gerar planos, legendas, imagens | ✅ Sim (para a IA) |
| **App na Meta** (Facebook/Instagram) | Publicar posts e CRM do IG | ✅ Sim (para publicação) |
| **Stripe** | Cobrança recorrente | ⭕ Opcional (quando for cobrar) |
| **WhatsApp Business** | Mensagens/CRM por WhatsApp | ⭕ Opcional (a montar) |
| **Ideogram** | Gerar foto realista por IA | ⭕ Opcional (já ligado) |

**Como o sistema "sabe" desses serviços:** por **variáveis de ambiente** (configurações secretas guardadas na Vercel). A regra é simples: **sem a variável, aquela função não funciona** (mas o resto do sistema continua no ar). As principais:

- `KV_REST_API_URL` / `KV_REST_API_TOKEN` → banco (Redis)
- `BLOB_READ_WRITE_TOKEN` → armazenamento de mídia
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` → login
- `ANTHROPIC_API_KEY` → IA
- `APP_ID` / `APP_SECRET` / `INSTAGRAM_APP_ID` → Meta/Instagram
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` → e-mail
- `CRON_SECRET` → protege as tarefas automáticas
- *(opcionais)* `STRIPE_SECRET_KEY`, `WHATSAPP_TOKEN`, `IDEOGRAM_API_KEY`, chaves VAPID (push)

**Tarefas automáticas (crons) que rodam sozinhas:** publicar posts agendados (a cada minuto), alertas de SLA/renovação (de hora em hora), prazos de tarefa, follow-up de vendas (diário), resumo semanal (segundas), automações (a cada 15 min) e **backup (diário às 6h)**.

---

## 9. O que depende de ação humana (não é código)

Algumas coisas **não** se resolvem programando — dependem de contas, aprovações e chaves que só a pessoa responsável configura:

- **App Review da Meta** — em análise; é o que libera o CRM do Instagram Direct. *(Enquanto isso, o 2FA global fica desligado.)*
- **WhatsApp Business na Meta** — montar número dedicado + credenciais para ligar o WhatsApp (código já está pronto, esperando isso).
- **Stripe** — colocar as chaves na Vercel + criar o webhook, para a cobrança recorrente entrar no ar.
- **Monitor de uptime** — plugar o endereço `/api/health` num serviço gratuito (ex.: UptimeRobot) que avisa se o site cair.
- **Re-sincronizar fotos dos clientes** — um botão na tela (1 clique) que conserta logos que expiram.
- **Contas das lojas de app** (Apple/Google) — se um dia empacotar como app de celular.

---

## 10. Roadmap — pronto vs. o que falta

**Pronto e no ar (código):**
- Núcleo de aprovação, produção (Studio IA), publicação Meta, tarefas, CRM, financeiro, portal do cliente.
- Plano modular + suspensão por inadimplência (falta só ligar o Stripe).
- Robustez completa (observabilidade, testes, backup/DR, auditoria, monitoramento).
- Segurança completa (2FA, anti-força-bruta, LGPD, permissões).

**Falta (ação humana):** App Review Meta · Stripe · WhatsApp Business · monitor de uptime.

**Ideias futuras (código, quando quiser):** dashboard de anúncios (aguarda APIs), NPS mais completo, app nas lojas (Capacitor), afinar as visões de add-on do cliente.

---

## 11. Roteiro sugerido de apresentação (~30 min)

| # | Bloco | Tempo | Mensagem central |
|---|---|---|---|
| 1 | O que é / por que existe | 3 min | "É nosso, substitui o GoHighLevel." |
| 2 | Construído com Claude Code | 4 min | "IA que programa — ideia vira realidade em minutos." |
| 3 | Conceitos básicos | 2 min | Nivelar o vocabulário. |
| 4 | Arquitetura (1 slide) | 3 min | "Um app só, banco em SP, integrações." |
| 5 | Como editamos ao vivo | 5 min | "Edita → testa → publica em ~1 min, com portão de segurança." |
| 6 | A jornada em fases | 4 min | "Incremental: cada fase resolveu uma dor." |
| 7 | Segurança | 4 min | "2FA, LGPD, auditoria, backup — e o porquê do 2FA off (Meta)." |
| 8 | Infraestrutura | 3 min | "O que precisa existir e custa." |
| 9 | O que falta (ação humana) | 2 min | "Meta, Stripe, WhatsApp, uptime." |

> Dica de condução: **não abra o código** na reunião. Fale por analogias e mostre, se possível, **uma edição ao vivo** (uma mudança pequena entrando no ar em ~1 min) — é o que mais impressiona e resume tudo.

---

## 12. Glossário de bolso

- **Deploy** — publicar uma mudança (colocar no ar).
- **Commit** — salvar um pacote de mudanças com descrição.
- **Build** — montar o sistema pronto para rodar.
- **Branch `main`** — a "linha oficial" do código; o que está nela vai pro ar.
- **API** — porta de comunicação entre a tela e os bastidores.
- **Banco de dados (Redis)** — onde as informações ficam guardadas.
- **Cron** — tarefa automática agendada.
- **2FA** — verificação em 2 fatores (senha + código).
- **LGPD** — lei de proteção de dados; aqui: exportar/apagar dados do cliente.
- **Variável de ambiente** — configuração secreta (chave de um serviço externo).
- **Rollback** — reverter para a versão anterior.
- **Portão de testes** — a checagem automática que impede um deploy quebrado.

---

*Documento gerado como base de apresentação. Detalhes técnicos completos e o histórico de evolução estão no `CONTEXTO-TECNICO.md` do projeto.*
