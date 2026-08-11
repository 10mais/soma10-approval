# MULTITENANT-CHECKLIST.md — inventário de acesso ao Redis (gerado)

> Gerado por `node scripts/mapear-chaves.mjs` em 2026-08-11.
> 125 arquivos · 695 chamadas. Marcar o checkbox = arquivo migrado
> para o wrapper (dbDaRequest/dbOrg) E listado em tests/isolamentoOrg.test.ts.

| ✔ | Arquivo | Chamadas | Métodos | Famílias de chave |
|---|---------|----------|---------|-------------------|
| [ ] | app/api/posts/route.ts | 29 | del, get, sadd, set, smembers, srem | agendados · plano: · post: · posts · posts_excluidos · tarefa: |
| [ ] | app/api/tarefas/route.ts | 29 | del, sadd, set, smembers, srem | post: · tarefa: · tarefas · tarefas_excluidas · usuarios |
| [ ] | app/api/crm/contatos/route.ts | 24 | del, sadd, set, smembers, srem | contato: · crm: · empresa: · tarefa: · tarefas · usuarios |
| [ ] | lib/lgpd.ts | 24 | del, smembers, srem, zrem | agendados · aprovtoken: · cliente: · clientes · log: · logs: · notificacoes: · nps · nps: · npstoken: · post: · posts · statustoken: · usuario: · usuarios |
| [ ] | app/api/reservas/route.ts | 23 | del, sadd, set, smembers, srem | lancamento: · lancamentos · reserva: · reservas · reservatoken: · viagem: |
| [ ] | app/api/cron/tarefas/route.ts | 17 | expire, get, sadd, set, smembers | tarefa: · tarefas · usuarios · veiculos |
| [ ] | app/api/processos/route.ts | 17 | del, sadd, set, smembers, srem | lancamento: · lancamentos · processo: · processos |
| [ ] | app/api/vendas/route.ts | 15 | del, incrby, sadd, set, smembers, srem | lancamento: · lancamentos · movestoque · movestoque: · venda: · vendas |
| [ ] | app/api/admin/migrar-turismo/route.ts | 14 | get, sadd, set, smembers | excursoes · onibus · reserva: · reservas · veiculo: · veiculos · viagem: · viagens |
| [ ] | app/api/planos/route.ts | 14 | del, sadd, set, smembers, srem | agendados · plano: · planos · post: · posts · tarefa: |
| [ ] | app/api/crm/contatos/mesclar/route.ts | 13 | del, set, smembers, srem | agendamento: · agendamentos · contato: · crm: · espera: · esperas · ig: · negocio: · wa: |
| [ ] | app/api/agenda/route.ts | 12 | del, sadd, set, smembers, srem | agendamento: · agendamentos · bloqueios · contato: · crm: |
| [ ] | app/api/crm/mensagens/route.ts | 12 | del, lrange, lset, set, smembers, srem | wa: |
| [ ] | app/api/cron/alertas/route.ts | 11 | expire, get, set, smembers | clientes · posts |
| [ ] | app/api/clientes/route.ts | 10 | del, get, sadd, set, srem | cliente: · clientes · usuario: · usuarios |
| [ ] | app/api/crm/converter/route.ts | 10 | get, sadd, set | cliente: · clientes · marco: · marcos · negocio: · tarefa: · tarefas · usuario: · usuarios |
| [ ] | app/api/documentos/route.ts | 10 | del, sadd, set, smembers, srem | doctoken: · documento: · documentos |
| [ ] | app/api/esteira/aprovar/route.ts | 9 | sadd, set, srem | agendados · post: |
| [ ] | app/api/notificacoes/route.ts | 9 | del, set, smembers, srem | notificacao: · notificacoes: |
| [ ] | lib/tarefasDaPauta.ts | 9 | sadd, set, smembers | plano: · post: · tarefa: · tarefas |
| [ ] | app/api/cron/publicar/route.ts | 8 | sadd, set, smembers, srem | agendados · cliente: · clientes · post: · tokens: |
| [ ] | app/api/decision/route.ts | 8 | sadd, set, srem | agendados · post: · tarefa: · tarefas |
| [ ] | app/api/estoque/route.ts | 8 | incrby, sadd, set, smembers | movestoque · movestoque: · produtos |
| [ ] | app/api/frota/route.ts | 8 | del, sadd, set, smembers, srem | reservas · veiculo: · veiculos · viagens |
| [ ] | app/api/reunioes/route.ts | 8 | del, sadd, set, smembers, srem | reuniao: · reunioes · tarefa: · tarefas |
| [ ] | lib/whatsapp.ts | 8 | lrange, lset, rpush, sadd, set | wa: |
| [ ] | app/api/agentes/executar/route.ts | 7 | lpush, ltrim, sadd, set, smembers | agente: · clientes · marco: · marcos · tarefa: · tarefas |
| [ ] | app/api/crm/negocios/route.ts | 7 | del, sadd, set, smembers, srem | crm: · negocio: · usuarios |
| [ ] | app/api/crm/pipelines/route.ts | 7 | set, smembers | crm: · negocio: |
| [ ] | app/api/viagens/route.ts | 7 | del, sadd, set, smembers, srem | reservas · viagem: · viagens |
| [ ] | lib/assistenteTools.ts | 7 | smembers | clientes · crm: · despesas · tarefas · usuarios |
| [ ] | lib/automacoesEngine.ts | 7 | sadd, set, zadd, zrem | automacoes: · marco: · marcos · tarefa: · tarefas |
| [ ] | lib/notificacoes.ts | 7 | sadd, set, smembers | notificacao: · notificacoes: · usuarios |
| [ ] | lib/postsIndex.ts | 7 | get, sadd, set, smembers, srem | cliente: · posts |
| [ ] | app/api/briefings/route.ts | 6 | del, sadd, set, smembers, srem | briefing: · briefings |
| [ ] | app/api/candidaturas/route.ts | 6 | del, sadd, set, smembers, srem | candidatura: · candidaturas |
| [ ] | app/api/clientes/conectar/route.ts | 6 | set | cliente: |
| [ ] | app/api/crm/empresas/route.ts | 6 | del, sadd, set, smembers, srem | crm: · empresa: |
| [ ] | app/api/despesas/route.ts | 6 | del, sadd, set, smembers, srem | despesa: · despesas |
| [ ] | app/api/esteira/relacionar/route.ts | 6 | sadd, set, smembers | plano: · post: · tarefa: · tarefas |
| [ ] | app/api/mapas/route.ts | 6 | del, sadd, set, smembers, srem | mapa: · mapas |
| [ ] | app/api/mensagens/route.ts | 6 | rpush, set, smembers | chat: · usuarios |
| [ ] | app/api/nps/route.ts | 6 | del, sadd, set | cliente: · nps · nps: · npstoken: |
| [ ] | app/api/pacotes/route.ts | 6 | del, sadd, set, smembers, srem | pacote: · pacotes |
| [ ] | app/api/pacotes-viagem/route.ts | 6 | del, sadd, set, smembers, srem | pacotesviagem · pacoteviagem: |
| [ ] | app/api/playbook/route.ts | 6 | del, sadd, set, smembers, srem | marco: · marcos |
| [ ] | app/api/produtos/importar/route.ts | 6 | incrby, sadd, set, smembers | movestoque · movestoque: · produto: · produtos |
| [ ] | app/api/produtos/route.ts | 6 | del, sadd, set, smembers, srem | produto: · produtos |
| [ ] | app/api/templates/route.ts | 6 | del, sadd, set, smembers, srem | template: · templates |
| [ ] | app/api/usuarios/route.ts | 6 | del, get, sadd, set, srem | usuario: · usuarios |
| [ ] | lib/instagramDM.ts | 6 | rpush, sadd, set, smembers | clientes · config: · ig: |
| [ ] | lib/perfisInstancia.ts | 6 | set | config: · crm: |
| [ ] | app/api/agenda/bloqueios/route.ts | 5 | del, sadd, set, smembers, srem | bloqueio: · bloqueios |
| [ ] | app/api/agenda/espera/route.ts | 5 | del, sadd, set, smembers, srem | espera: · esperas |
| [ ] | app/api/briefings/relacionar/route.ts | 5 | sadd, set | briefing: · tarefa: · tarefas |
| [ ] | app/api/crm/mensagens-instagram/route.ts | 5 | lrange, set, smembers | clientes · ig: |
| [ ] | app/api/financeiro/lancamentos/route.ts | 5 | del, sadd, set, smembers, srem | lancamento: · lancamentos |
| [ ] | app/api/setup/route.ts | 5 | sadd, set, smembers | config: · usuario: · usuarios |
| [ ] | app/api/status/route.ts | 5 | del, set, smembers | cliente: · clientes · statustoken: |
| [ ] | app/api/templates/aplicar/route.ts | 5 | sadd, set, smembers | marco: · marcos · tarefa: · tarefas |
| [ ] | lib/assistenteConversas.ts | 5 | del, sadd, set, smembers, srem | (dinâmicas) |
| [ ] | lib/erros.ts | 5 | lpush, lrange, ltrim, set | erro: · erro_alerta: · erros: |
| [ ] | lib/logCliente.ts | 5 | set, zadd, zremrangebyscore | log: · logs: |
| [ ] | app/api/2fa/route.ts | 4 | set | usuario: |
| [ ] | app/api/aprovacao-link/route.ts | 4 | del, set, smembers | aprovtoken: · cliente: · posts |
| [ ] | app/api/dashboard-vendas/route.ts | 4 | smembers | clientes · crm: · nps · posts |
| [ ] | lib/apagarMensagem.ts | 4 | lrange, lrem, lset, set | (dinâmicas) |
| [ ] | lib/auditoria.ts | 4 | lpush, lrange, ltrim, set | audit: · auditoria: |
| [ ] | app/api/assistente/chat/route.ts | 3 | smembers | clientes · crm: |
| [ ] | app/api/automacoes/route.ts | 3 | set | (dinâmicas) |
| [ ] | app/api/crm/msg-templates/route.ts | 3 | set | config: |
| [ ] | app/api/cron/crm-followup/route.ts | 3 | set, smembers | crm: |
| [ ] | app/api/esteira/gerar-plano/route.ts | 3 | sadd, set | plano: · post: · posts |
| [ ] | app/api/procedimentos/route.ts | 3 | set | (dinâmicas) |
| [ ] | lib/anthropicSaldo.ts | 3 | set, smembers | usuarios |
| [ ] | lib/assentos.ts | 3 | del, set | (dinâmicas) |
| [ ] | lib/loginThrottle.ts | 3 | del, expire, incr | (dinâmicas) |
| [ ] | lib/publicar.ts | 3 | del, set | post: |
| [ ] | app/api/clientes/resync-fotos/route.ts | 2 | set, smembers | cliente: · clientes |
| [ ] | app/api/clientes/senha/route.ts | 2 | set | cliente: · usuario: |
| [ ] | app/api/crm/biblioteca/route.ts | 2 | set | (dinâmicas) |
| [ ] | app/api/crm/playbook/route.ts | 2 | set | (dinâmicas) |
| [ ] | app/api/crm/sugerir-perguntas/route.ts | 2 | lrange, smembers | crm: · wa: |
| [ ] | app/api/mapas/gerar-ia/route.ts | 2 | sadd, set | mapa: · mapas |
| [ ] | app/api/meta/pages/route.ts | 2 | del, get | metapages: |
| [ ] | app/api/perfil-instancia/route.ts | 2 | del, set | config: |
| [ ] | app/api/publicar/route.ts | 2 | set, srem | agendados · post: |
| [ ] | app/api/push/subscribe/route.ts | 2 | sadd, srem | push: |
| [ ] | app/api/reserva-publica/route.ts | 2 | set, smembers | reserva: · reservas |
| [ ] | app/api/solicitar-briefing/route.ts | 2 | sadd, set | tarefa: · tarefas |
| [ ] | app/api/stripe/webhook/route.ts | 2 | set, smembers | cliente: · clientes |
| [ ] | app/api/tipos-tarefa/route.ts | 2 | set | (dinâmicas) |
| [ ] | app/api/whatsapp/webhook/route.ts | 2 | get, set | (dinâmicas) |
| [ ] | lib/cache.ts | 2 | smembers | clientes · usuarios |
| [ ] | lib/crmPipelines.ts | 2 | set | (dinâmicas) |
| [ ] | lib/rateLimit.ts | 2 | expire, incr | (dinâmicas) |
| [ ] | lib/twoFactorEmail.ts | 2 | del, set | (dinâmicas) |
| [ ] | lib/webpush.ts | 2 | smembers, srem | push: |
| [ ] | app/api/brand/gerar-documento/route.ts | 1 | set | cliente: |
| [ ] | app/api/brand/playbook/route.ts | 1 | set | cliente: |
| [ ] | app/api/config/route.ts | 1 | set | config: |
| [ ] | app/api/crm/estagios/route.ts | 1 | set | (dinâmicas) |
| [ ] | app/api/cron/resumo-semanal/route.ts | 1 | smembers | clientes |
| [ ] | app/api/esteira/gerar-copy/route.ts | 1 | set | post: |
| [ ] | app/api/financeiro/contas/route.ts | 1 | set | (dinâmicas) |
| [ ] | app/api/foto-cliente/route.ts | 1 | set | cliente: |
| [ ] | app/api/health/route.ts | 1 | ping | (dinâmicas) |
| [ ] | app/api/instagram/callback/route.ts | 1 | set | metapages: |
| [ ] | app/api/lojas/route.ts | 1 | set | (dinâmicas) |
| [ ] | app/api/meta/callback/route.ts | 1 | set | metapages: |
| [ ] | app/api/meta/diagnostico/route.ts | 1 | smembers | clientes |
| [ ] | app/api/meu-perfil/route.ts | 1 | set | usuario: |
| [ ] | app/api/notif-prefs/route.ts | 1 | set | notif: |
| [ ] | app/api/notificacoes-config/route.ts | 1 | set | config: |
| [ ] | app/api/operacional/route.ts | 1 | set | config: |
| [ ] | app/api/permissoes-granular/route.ts | 1 | set | config: |
| [ ] | app/api/permissoes-papel/route.ts | 1 | set | config: |
| [ ] | app/api/personal/route.ts | 1 | set | personal: |
| [ ] | app/api/playbook/entregas/route.ts | 1 | smembers | (dinâmicas) |
| [ ] | app/api/resumo-templates/route.ts | 1 | set | (dinâmicas) |
| [ ] | app/api/sistema/route.ts | 1 | ping | (dinâmicas) |
| [ ] | app/api/stripe/cobrar/route.ts | 1 | set | cliente: |
| [ ] | app/api/viagens/manifesto/route.ts | 1 | smembers | reservas |
| [ ] | lib/resumoSemanal.ts | 1 | smembers | posts |
| [ ] | lib/seguranca.ts | 1 | set | config: |
