# Instâncias por cliente — runbook de provisionamento (~30 min)

> Modelo "Caminho A": **mesmo código, um deploy + um banco por cliente**.
> Isolamento total por construção. Um `git push origin main` atualiza TODAS as
> instâncias (o portão de testes protege todas de uma vez).

## 1. Banco (Upstash) — ~5 min
1. https://console.upstash.com → **Create Database**
2. Nome: `soma10-{cliente}` (ex.: `soma10-norah`) · Região: **sa-east-1 (São Paulo)** · Pay-as-you-go
3. Copie **UPSTASH_REDIS_REST_URL** e **UPSTASH_REDIS_REST_TOKEN** (vão virar `KV_REST_API_URL`/`KV_REST_API_TOKEN`)

## 2. Projeto na Vercel — ~10 min
1. vercel.com → **Add New → Project** → importar o MESMO repo `10mais/soma10-approval`
2. Nome do projeto: `soma10-{cliente}` → Deploy (a 1ª build já roda o portão de testes)
3. **Settings → Environment Variables** (Production):

| Var | Valor |
|---|---|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | do passo 1 (banco DESTE cliente) |
| `NEXTAUTH_SECRET` | **novo** (gerar aleatório 32+ chars — nunca reusar o da agência) |
| `NEXTAUTH_URL` | `https://{cliente}.soma10.com.br` |
| `APPROVAL_BASE_URL` | idem |
| `CRON_SECRET` | **novo** (aleatório) |
| `BLOB_READ_WRITE_TOKEN` | criar um **Blob store próprio** (Storage → Create → Blob) e conectar ao projeto. ⚠️ **O Blob novo da Vercel NÃO gera essa env sozinho** — abra o store → aba **`.env.local`** do Quickstart, copie o valor `BLOB_READ_WRITE_TOKEN` e **crie a env na mão** nas Environment Variables do projeto |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ao conectar o Upstash Redis (Marketplace) ao projeto, use **prefixo de env `KV`** — senão sai como `STORAGE_*` e o app não acha |
| `ANTHROPIC_API_KEY` | só se o cliente contratou módulos de IA |
| Meta/Instagram/Stripe/Ideogram/GEMINI/SMTP | **NÃO setar** salvo contratado — as integrações ficam cinza na Saúde do sistema e os recursos somem/no-op |

4. **Settings → Domains** → adicionar `{cliente}.soma10.com.br` (criar o CNAME no DNS da soma10.com.br apontando pra `cname.vercel-dns.com`)
5. Redeploy após salvar as envs

## 3. Primeiro acesso — ~2 min
1. `POST https://{cliente}.soma10.com.br/api/setup` com JSON `{ "nome", "email", "senha", "nomeEmpresa", "perfil" }`
   (ou via console do navegador na página de login):
```js
fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:'Dono',email:'dono@cliente.com',senha:'TROQUE-8+chars',nomeEmpresa:'Nome da Empresa',perfil:'clinica'})}).then(r=>r.json()).then(console.log)
```
2. **`perfil` (opcional) pré-configura a instância inteira** — permissões por papel, telas da equipe e funil de CRM. `GET /api/setup` lista os disponíveis:
   - **`clinica`** — CRM (funil de pacientes: Lead → Contato → Avaliação agendada → Compareceu → Orçamento → Fechou/Não fechou) + Agenda. Equipe sem Estratégia/Studio/Planner. *(Norah, Phenoma — toda clínica nasce igual)*
   - **`gestao`** — CRM + Financeiro (admin) + Projetos (Playbook/Tarefas/Modelos/Documentos). Equipe sem Studio/Planner/Agenda/Campanhas. *(Sua Dupla Cidadania)*
   - **`turismo`** — operadora de excursões rodoviárias: CRM (funil "Vendas de Viagem": Novo lead → Cotação → Proposta → Reserva → Pago → Emitido/Perdido) + Financeiro (admin) + módulos de Operação (Excursões/Ônibus/Reservas/Recebíveis). Equipe sem Estratégia/Studio/Planner/Agenda clínica/Trabalhe Conosco. *(Deny Turismo)*
   - Sem `perfil` = padrão da agência (tudo ligado). Perfil desconhecido = 400 (evita typo silencioso).
3. A rota **só funciona com o banco vazio** — depois do 1º admin ela tranca (403).
4. Logar → **Minha Conta**: trocar a senha → **Config → Geral**: logo/cores da empresa.

## 4. Ajustar módulos (se precisar) — ~2 min
- O **admin** (dono da empresa) vê tudo.
- O `perfil` do passo 3 já deixa as permissões da equipe no ponto; ajustes finos em **Config → Permissões por papel** (telas + ações) para `gerente`/`usuario`.
- Módulos que dependem de credencial (IA, publicação social, Stripe) já ficam no-op sem a env — não precisa esconder.

## 5. Pós-provisionamento (checklist)
- [ ] Saúde do sistema: essenciais verdes (Redis/Blob/Auth) · CRON_SECRET verde
- [ ] Criar os usuários da equipe do cliente (Colaboradores)
- [ ] Cron de backup roda sozinho (nativo da Vercel, diário 6h) — conferir `backups/` no dia seguinte
- [ ] Plugar `/api/health` da instância no UptimeRobot (monitor novo por instância)

## Notas
- **Custo marginal/instância:** Upstash PAYG (centavos) + Blob (centavos) — a Vercel Pro cobre N projetos.
- **Atualizações:** todas as instâncias acompanham a `main`. Se um dia for preciso congelar um cliente, muda o Production Branch do projeto dele.
- **Migração futura p/ multi-tenant:** os bancos separados por cliente tornam a migração limpa (importar cada banco como uma org).
