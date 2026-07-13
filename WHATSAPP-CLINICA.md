# WhatsApp da clínica — conector "WhatsApp Web" (Evolution API)

> ✅ **NO AR NA NORAH (2026-07-13).** Host Evolution no Railway (template Douglas Rubim),
> instância `norah` pareada (Baileys/QR), envio+recebimento pelo Soma10, inbox no CRM,
> tela de conexão em Config → Integrações → WhatsApp. Código: §37.6 do CONTEXTO-TECNICO.
> Este runbook fica como referência p/ novas instâncias (cada clínica = 1 host + 1 QR).
>
> Objetivo: caixa de entrada de WhatsApp **dentro do Soma10 usando o MESMO número
> antigo da clínica**, sem migrar para a Cloud API oficial (que tiraria o número
> do celular). Abordagem = conector estilo WhatsApp Web (pareia por QR Code).
> É o que o sistema anterior da Norah usava ("WhatsApp Lite").

## Por que NÃO a API oficial (Cloud API)
A Cloud API da Meta exige **migrar o número para os servidores da Meta** → o número
**para de funcionar no app do celular**. Inaceitável para um número antigo com histórico.

## Riscos e limites (transparência)
- **Não-oficial**: usa o protocolo do WhatsApp Web. Vai contra os Termos da Meta;
  risco de bloqueio existe (baixo para atendimento normal, real em disparo em massa).
  → **NÃO usar para disparo em massa/spam.** Só atendimento e follow-up humano.
- Precisa de um **processo sempre-ligado** — a Vercel é serverless e não segura a
  conexão. Roda num host separado (o Evolution API).
- **Um número = um pareamento.** Cada clínica pareia o seu.

## Arquitetura
```
Celular da clínica  ──QR──▶  Evolution API (host sempre-ligado)  ──webhook──▶  Soma10 (/api/whatsapp/webhook)
        ▲                            │                                              │
        └──────────────  mensagens enviadas via REST  ◀──────────────  lib/whatsapp.ts
```

## PARTE DO DONO — provisionar o host (~30-40 min)
1. **Criar o host do Evolution API** (open-source, brasileiro):
   - Opção fácil: **Railway** ou **Render** (deploy do container `atendai/evolution-api` ou `evoapicloud/evolution-api`). Custo ~US$5-10/mês.
   - Opção VPS: Hostinger/Contabo + Docker (`docker run evolution-api`), atrás de HTTPS.
   - Definir uma **API KEY** forte (variável `AUTHENTICATION_API_KEY` do Evolution).
2. **Criar uma instância** no Evolution (ex.: `norah`) e **parear**: abrir o QR e
   escanear com o WhatsApp da clínica (WhatsApp Web do celular). O número segue no celular.
3. **Anotar** (guardar em local seguro, NÃO colar no chat):
   - URL pública do Evolution (ex.: `https://evolution-norah.up.railway.app`)
   - API KEY do Evolution
   - Nome da instância (ex.: `norah`)
4. **Apontar o webhook** do Evolution para: `https://norah.soma10.com.br/api/whatsapp/webhook`
   (eventos de mensagem recebida). Definir um `WHATSAPP_VERIFY_TOKEN` combinado.

## PARTE DO CLAUDE — wiring no Soma10 (depois que o host existir)
Assim que o dono tiver URL/KEY/instância, eu ligo o Soma10 (já há scaffold em
`lib/whatsapp.ts` + `/api/whatsapp/webhook`; hoje aponta para a Cloud API — troco p/ Evolution):
- Envs por instância (Vercel): `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`,
  `EVOLUTION_INSTANCE`, `WHATSAPP_VERIFY_TOKEN` (o `enviarWhatsApp` fica no-op sem elas).
- `lib/whatsapp.ts`: enviar via `POST {EVOLUTION_API_URL}/message/sendText/{instance}`.
- `/api/whatsapp/webhook`: receber o payload do Evolution (formato diferente da Cloud API),
  gravar em `wa:conversa:{tel}` / `wa:msgs:{tel}` (chaves já existem) e notificar a equipe.
- **Inbox no CRM** (aba Mensagens): lista de conversas + thread + enviar. (a construir)

## Estado atual do código (2026-07-13) — ✅ FEITO
- `lib/whatsapp.ts`: transporte Evolution (`enviarWhatsApp` prioriza Evolution; `normalizarUrlEvolution`
  aceita URL sem https://; `textoMensagemEvolution`, `fotoPerfilEvolution`). `/api/whatsapp/webhook`
  detecta Evolution vs Meta. `/api/whatsapp/conexao` (status/QR/logout + registra webhook). `WhatsAppConexao.tsx`.
- **Inbox no CRM** (aba Mensagens): envia/recebe/busca/foto+nome.
- **Falta (opcional):** busca full-text nas mensagens antigas; envio de mídia/anexos pelo inbox.

## Alternativa zero-risco (se um dia quiser desligar o conector)
`wa.me` "clicar e conversar" com mensagem pré-preenchida (já usado nos aniversariantes).
Mantém o número, sem infra, sem risco — mas não é caixa unificada.
