# Soma10 Clínicas — plano de produto (referência: sistema atual da Norah)

> Fonte: 15 prints do sistema que a Norah usa hoje ("Clínica Experts"), analisados em 2026-07-13.
> Objetivo: substituí-lo para clínicas (Norah, Phenoma, futuras) DENTRO do código único do
> Soma10 — comportamento ativado pelo perfil `clinica`, sem fork. Marca do produto: Soma10 (decisão do dono).
> Prints em `C:\Users\Wiliam\Desktop\REFERENCIA CLINICAS\` (máquina do dono; contêm dados reais — não versionar).

## O que o sistema de referência tem (inventário por tela)

| Tela | Funcionalidades |
|---|---|
| **Dashboard** | Fluxo de caixa (dia/semana/mês/ano) · balanço real×previsto c/ olho de privacidade · agendamentos das próximas 24h · próximos aniversariantes com atalho WhatsApp |
| **Agenda** | Semana/dia · mini-calendário mensal · filtros por profissional · lista de espera · feriados marcados · quick-add |
| **Contatos** | Hub: Pacientes / Profissionais / Fornecedores / Leads / Todos · etiquetas · ativo on/off · aniversariantes · frequência · mesclar duplicados · exportar/ações em lote · telefone com link WhatsApp |
| **CRM — visão geral** | Cards criadas/andamento/ganhas/perdidas (R$) · funil gráfico por etapa · leads · conversão % · **origem** (Instagram/Ex-paciente/Indicação) · filtro por funil |
| **CRM — oportunidades** | Kanban **multi-funil** (ex.: funil "Agendamentos": Lead novo → Em conversa → Em agendamento → Consulta paga → Compareceu → Não compareceu) · card com R$, paciente vinculado, data, **alerta de follow-up atrasado**, responsável · totais por coluna |
| **CRM — tarefas** | Cadência de follow-up: tarefa ("WhatsApp para X") vinculada à oportunidade + lead, prazo, responsável, status atrasada/concluída |
| **Vendas** | Faturamento, nº vendas, valor orçado, ticket médio · gráfico faturamento×vendas · **orçamentos** (aberto/ganho/perdido) · vendas por tipo · relatórios (pacotes/carteiras/margens) · notas fiscais |
| **Financeiro** | Receitas/despesas/**a receber**/**a pagar** · fluxo de caixa · **contas financeiras** (banco/caixa com saldo) · extrato · competência · categorias · métodos de pagamento · maquininha |
| **Comissões** | Em aberto/finalizadas · tabela de comissão por venda e por atendimento · relatório |
| **Estoque** | Itens (categoria, disponível, custo médio, preço, ativo) · alertas estoque baixo/alto · lotes e validades · giro · contagem · compras · marcas |
| **Comunicação** | Canais (WhatsApp conectado) · modelos de mensagens · central de notificações · chatbot IA ("Anna") com transferência p/ humano |
| **CliniDocs** | Documentos com **assinatura eletrônica** (rascunho/aguardando/assinado/rejeitado) · modelos de documentos |
| **Preferências** | Fuso/moeda · ocultar financeiro · DRE · abertura de caixa · conciliação bancária · WhatsApp web/app · configs do chatbot |
| **Atendimentos** | (sem print — item de menu; prontuário/registro de atendimento presumido) |

## Mapa: já existe × adaptar × construir

**JÁ EXISTE no Soma10 (usa como está ou com rótulo novo):**
- Agenda semana/dia por profissional, conflito, encaixe (módulo Agenda)
- CRM kanban **multi-pipeline** (crm:pipelines), estágios configuráveis, painel (win rate, ticket, funil, por vendedor), follow-up com lembrete/cron, import/export CSV de contatos
- Tarefas (checklist, horas, responsável, prazos + cron de atraso)
- Financeiro: fluxo de caixa, contas/lançamentos futuros, despesas recorrentes, DRE, olho de privacidade, saúde do caixa
- Documentos (editor rico), Notificações, Push/PWA, permissões por papel/tela, auditoria, backup/DR
- WhatsApp Cloud scaffold (aguarda chip/credencial — ação do dono)

**ADAPTAR (perfil clinica muda comportamento/rótulo):**
- Contatos → **Pacientes** (tipo de contato, etiquetas, ativo, aniversário)
- Agendamento ↔ vínculo com paciente (hoje é texto livre) + histórico por paciente
- Funil semente do perfil → **"Agendamentos"** (Lead novo → ... → Compareceu/Não compareceu) + campo **origem** no negócio
- Home → versão clínica (agenda 24h, aniversariantes, funil da semana, fluxo de caixa se admin)
- Tarefas de cadência na visão do CRM (lista por oportunidade)
- Tipos de tarefa de clínica; notificações de agência desligadas por perfil

**CONSTRUIR (não existe em nenhuma forma):**
- Lista de espera da agenda · mini-calendário/visão mês · **feriados na agenda**
- Mesclar contatos · frequência de pacientes · **ações em lote nas listas**
- Contas a receber/pagar com status + contas financeiras múltiplas + métodos de pagamento
- **Extrato de movimentações · relatório de competência · abertura/fechamento de caixa**
- Orçamentos (proposta → aceito/perdido) · comissões por profissional
- **Pacotes de tratamento** (venda de pacote com N sessões + consumo por atendimento) e relatórios de vendas (pacotes/carteiras/margens)
- Estoque (sinergia: Space Technology também precisa) · NF (fase 2 obrigatória, integrador)
- Assinatura eletrônica de documentos (avaliar integração vs. construir) + modelos de documentos
- Chatbot WhatsApp (depende da API oficial + chip — pós App Review/chip)
- **Integração maquininha** (Stone/Pag etc.) — avaliar; sem paridade prometida por ora
- Conciliação bancária — **mesma feature do track Deny/OFX Sicredi** (construir uma vez, servir os dois)

**NÃO APLICÁVEL por decisão de produto:** fuso/moeda configuráveis (produto é pt-BR/R$).

**CONFIRMADO pelo dono (2026-07-13):** prontuário/registro de atendimento SIM (→F2, atenção LGPD dado de saúde) · pacotes de tratamento SIM (→F3) · abertura/fechamento de caixa SIM (→F3). F1 aprovada para construção imediata.

## Fases propostas

- **F1 — Núcleo clínica (Norah dia 1): ✅ ENTREGUE 2026-07-13.** Paciente como entidade (contato tipado) + vínculo agenda↔paciente (match por nome normalizado ou auto-cadastro) + histórico de atendimentos no paciente + funil "Agendamentos" espelhando a referência + origem no painel + home clínica + `config:perfilInstancia` (setup grava; seletor em Config → Geral). Testes 77→81.
- **F2 — Operação diária:** lista de espera · visão mês/mini-calendário · feriados · etiquetas/ativo/aniversariantes com atalho wa.me · mesclar contatos · frequência de pacientes · ações em lote · modelos de mensagem (copiar/abrir WhatsApp Web, sem API) · tarefas de cadência na visão CRM · tipos de tarefa clínica no seed do perfil · (se confirmado) registro de atendimento/prontuário simples
- **F3 — Dinheiro:** a receber/a pagar + contas financeiras + métodos de pagamento · extrato · competência · abertura de caixa (se confirmado) · orçamentos · **pacotes de tratamento** (se confirmado) + relatórios de vendas · comissões (tabela por profissional) · conciliação bancária/OFX (compartilhada com track Deny)
- **F4 — Expansões:** estoque (compartilhado com Space) · assinatura eletrônica + modelos de documentos · chatbot IA no WhatsApp (pós-chip) · NF via integrador · maquininha (avaliar)

## Regras de arquitetura
1. Um código só; nada de fork por cliente. Tudo condicionado ao perfil da instância (`config:perfilInstancia`, gravado no setup; editável em Config para instâncias antigas).
2. Instância da agência NÃO muda (perfil ausente/`agencia` = comportamento atual).
3. Entidades novas seguem o padrão Redis (`entidade:{id}` + set índice) e as permissões por papel/tela existentes.
4. Testes no portão para toda lib nova (padrão do repo).
