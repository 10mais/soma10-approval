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
| `BLOB_READ_WRITE_TOKEN` | criar um **Blob store próprio** (Storage → Create → Blob) e conectar ao projeto |
| `ANTHROPIC_API_KEY` | só se o cliente contratou módulos de IA |
| Meta/Instagram/Stripe/Ideogram/GEMINI/SMTP | **NÃO setar** salvo contratado — as integrações ficam cinza na Saúde do sistema e os recursos somem/no-op |

4. **Settings → Domains** → adicionar `{cliente}.soma10.com.br` (criar o CNAME no DNS da soma10.com.br apontando pra `cname.vercel-dns.com`)
5. Redeploy após salvar as envs

## 3. Primeiro acesso — ~2 min
1. `POST https://{cliente}.soma10.com.br/api/setup` com JSON `{ "nome", "email", "senha", "nomeEmpresa" }`
   (ou via console do navegador na página de login):
```js
fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:'Dono',email:'dono@cliente.com',senha:'TROQUE-8+chars',nomeEmpresa:'Nome da Empresa'})}).then(r=>r.json()).then(console.log)
```
2. A rota **só funciona com o banco vazio** — depois do 1º admin ela tranca (403).
3. Logar → **Minha Conta**: trocar a senha → **Config → Geral**: logo/cores da empresa.

## 4. Liberar módulos conforme contratação — ~5 min
- O **admin** (dono da empresa) vê tudo.
- Para a equipe do cliente: **Config → Permissões por papel** (telas + ações) — desmarcar as telas dos módulos não contratados para `gerente`/`usuario`.
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
