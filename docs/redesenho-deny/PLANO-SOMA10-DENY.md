# SOMA10 Deny Turismo — plano do sistema completo de operadora

Instância: `denyturismo.soma10.com.br` (projeto Vercel `soma10-denyturismo`, perfil `turismo`).
Data: 15/11/2026. Pedido do dono: redesenhar no Lovable e cobrir todas as funcionalidades de
uma agência de viagens e turismo rodoviário (fretamento + excursões, Brasil e Mercosul).

## Sumário

0. Como usar este documento
1. Veredito: construir do zero ou aproveitar
2. O que já existe (verificado no código)
3. Melhorias no que existe — defeitos achados no levantamento
4. O que não existe
5. O fluxo pedido e onde o PDV entra
6. Plano por fases
7. Decisões que dependem do dono
8. Método: do Lovable ao código real

---

## 0. Como usar este documento

Cada linha da coluna "hoje" foi conferida no código em 15/11/2026, com arquivo e linha. Nada
aqui foi escrito de memória. Onde está escrito "não existe", eu procurei e não achei.

O documento serve a três leitores: o dono (para decidir ordem e escopo), o Lovable (para
desenhar as telas sabendo o que elas precisam conter) e eu (para implementar sem perder nada).

---

## 1. Veredito: construir do zero ou aproveitar

**Aproveitar a estrutura.** Com uma ressalva de método no fim desta seção.

### Por que aproveitar

O que já está pronto é justamente a parte cara, chata e arriscada de um sistema de operadora:

| Peça pronta | Por que ela é difícil de refazer |
|---|---|
| Croqui como **dado** por veículo (`lib/layoutVeiculo.ts`) | Cadastrar ônibus novo não exige programador. Tem pisos, corredor declarado, elementos (bar, banheiro, escada, porta, volante), `span`/`rowSpan` e deslocamento livre de poltrona. Isso nasceu de um croqui real da Deny. |
| **Snapshot do croqui na viagem** (`Viagem.layoutSnap`) | A viagem guarda o mapa que o passageiro comprou. Reformar um ônibus não muda a poltrona de quem já pagou. É o tipo de regra que ninguém pensa até dar problema. |
| Unicidade de poltrona (`lib/reservas.ts`) | Dois passageiros na mesma poltrona nunca acontece, nem entre reservas, nem dentro da mesma. Com trava de concorrência no link público. |
| Manifesto do DAER (`lib/manifesto.ts`) | Regra nacional × internacional, validação que barra lista incompleta antes de exportar, e já ordenado por número de poltrona. |
| Financeiro parcelado (`lib/financeiroContrato.ts`) | Parcela, vencimento, pagamento avulso, saldo, atraso — compartilhado com a assessoria de cidadania e testado. |
| WhatsApp pareado | Número da Deny conectado via Evolution no Railway, com inbox dentro do CRM. |
| Base viva | ~192 oportunidades no funil, contatos, viagens, reservas, frota, financeiro. |

Somando `lib/` de turismo: `layoutVeiculo`, `reservas`, `assentos`, `manifesto`, `pacoteViagem`,
`precificacaoViagem`, `conflitoVeiculo`, `calendarioViagens`, `frotaAlertas`,
`financeiroReserva`, `lancamentosReserva`, `proximoPasso`. Todas puras e com teste.

### O que custaria começar do zero

1. **Reparear o WhatsApp** — número novo ou nova sessão, com risco de banimento no processo.
2. **Migrar a base** — contatos, oportunidades, viagens, reservas e o financeiro delas.
3. **Reescrever regras que já custaram caro** — o croqui como dado, o snapshot, a unicidade de
   poltrona, a validação do manifesto. Cada uma dessas foi descoberta na prática.
4. **Recomeçar a confiança da equipe.** A Adrieli opera no sistema atual todo dia.

O que falta no sistema são **telas novas sobre dados que em boa parte já existem**. Um PDV de
viagem lê viagem, croqui, contato e financeiro — tudo com modelo pronto. Isso é adição, com
risco controlado.

### A ressalva de método

O Lovable cria projeto próprio, com stack própria (Supabase/Postgres). Importar o sistema para
lá significa um sistema diferente, com outro banco, outro deploy e outra integração de
WhatsApp. O caminho que já funcionou no Agency e na Clínica vale aqui: **o Lovable desenha, o
código continua neste repositório**. Ver seção 8.

---

## 2. O que já existe (verificado no código)

| Pedido do dono | Hoje | Onde |
|---|---|---|
| Lançar veículos e croqui com elementos extras | **Existe completo** — editor de croqui, pisos, corredor, elementos (bar, banheiro, escada, porta, volante, amenidade), capacidade contada do mapa | `lib/layoutVeiculo.ts`, `EditorLayoutVeiculo.tsx` |
| Liberdade de trocar poltronas | **Existe** — troca com trava de concorrência; 409 se a poltrona sumir de viagem futura com venda | `lib/assentos.ts`, `/api/reservas` |
| Lista com nomes + números em ordem de número | **Existe e já ordena assim** — poltrona crescente, depois nome; sem poltrona cai no fim | `lib/manifesto.ts:98` |
| Cadastro completo de viagens | **Existe** — pacote e fretamento, preço por faixa (adulto/criança/meia), inclusos, paradas dia a dia, hotéis do pacote, veículo, motoristas, status | `lib/redis.ts:406` |
| CRM com integração WhatsApp | **Existe** — funil, oportunidade ligada à viagem, chips de interessados por viagem, inbox de WhatsApp, Empresas para fretamento B2B | `app/components/CRM.tsx` |
| Suporte comercial (script de vendas) | **Existe desde 01/10** — 7 categorias de objeção, 2 cadências, 2 roteiros, 8 sequências de reaquecimento | `lib/bibliotecaSeeds/turismo.ts` |
| Perfis de leads / ficha | **Existe parcialmente** — `CrmContato` com histórico, próximos passos, preferências de viagem | `lib/redis.ts:1171` |
| Financeiro da reserva | **Existe** — parcelas, pagamentos, saldo, atraso, espelhado como lançamento | `lib/financeiroReserva.ts`, `lib/lancamentosReserva.ts` |
| Calendário de viagens | **Existe** — mês, lista e gantt, com bloqueio de conflito de veículo | `lib/calendarioViagens.ts`, `lib/conflitoVeiculo.ts` |
| Frota | **Existe** — veículos, documentos, alertas de vencimento | `lib/frotaAlertas.ts` |
| Exportar PDF | **Infra existe** — o sistema já gera PDF em outras telas | `lib/renderHtml.ts`, `lib/relatorioMensal.ts`, `lib/exportarMapa.ts` |
| "O que fazer agora" (próximo passo) | **Escrito e testado, fora do ar** — vive na branch `deny-soma10`, nunca foi para a `main` | `lib/proximoPasso.ts` |

---

## 3. Melhorias no que existe — defeitos achados no levantamento

Oito pontos que valem correção independentemente do redesenho.

1. **O calendário começa na segunda-feira.** `inicioDaSemana` faz `d.getDate() - ((d.getDay() + 6) % 7)`.
   O pedido é começar no domingo. Correção de uma linha, com teste.
   (`lib/calendarioViagens.ts`)

2. **Despesa de viagem não tem data nem responsável.** Hoje `DespesaViagem = { id, descricao, valor }`,
   pensada só para o break-even antes da viagem. Para lançar despesa extra durante a viagem
   faltam data, tipo, quem lançou, comprovante e a distinção entre previsto e realizado.
   (`lib/redis.ts:496`)

3. **A ordenação do manifesto usa `Number(poltrona)`.** O número é texto com zero à esquerda,
   do croqui de fábrica. Poltrona "10A" ou "L1" viraria `NaN` e cairia em posição imprevisível.
   Vale ordenação que entende número com sufixo. (`lib/manifesto.ts:118`)

4. **Frota está na navegação principal.** O pedido é movê-la para dentro de Configurações.

5. **Cliente e contato são a mesma coisa.** `CrmContato` virou lista única por uma decisão da
   clínica. Turismo precisa separar: quem comprou (cliente, com documento e histórico de
   viagens) e quem ainda está sendo trabalhado (lead).

6. **Documento do passageiro só tem validade de passaporte.** `Passageiro` tem `passaporte`,
   `passaporteValidade`, `rg`, `rgOrgao`. Faltam data de expedição do RG, validade do RG e o
   mesmo par para o passaporte virar informação acionável (alerta de vencimento).
   (`lib/reservas.ts:17`)

7. **O link público só escolhe poltrona.** Ele não coleta dado nenhum do passageiro.
   (`app/api/reserva-publica/route.ts`)

8. **O PDV que existe é de varejo.** `Vendas.tsx` vende produto com baixa de estoque, do perfil
   telefonia. Serve de referência de padrão de tela e não de base para venda de viagem.

---

## 4. O que não existe

| Pedido | Situação |
|---|---|
| Acompanhamento de viagem (viagem em andamento, ocorrências) | não existe |
| Lançamento de despesas extras durante a viagem | não existe (ver melhoria 2) |
| Check-in de embarque por poltrona | não existe — o `checkin` do código é de hotel (`checkinDia`/`checkinHora` do pacote) |
| Resumo de ocupação (livre, reservada, paga, bloqueada) | não existe como visão |
| Emissão de bilhete | não existe |
| Contrato da viagem (roteiro + inclusos + pagamento + validade) | não existe; só o financeiro parcelado |
| Orçamento de fretamento com status | não existe |
| Orçamento de viagem em PDF com layout importado | não existe |
| Validade de 7 dias da cotação | não existe |
| PDV de viagem | não existe |
| Oportunidade ganha vira pré-reserva | não existe |
| Rooming list | não existe (há hotéis no pacote, sem distribuição de quartos) |
| CRM em visualização mensal | não existe |
| Cadastro de cliente separado de contato | não existe (ver melhoria 5) |
| Link público para o cliente preencher os próprios dados | não existe (ver melhoria 7) |

---

## 5. O fluxo pedido e onde o PDV entra

O dono descreveu assim:

```
Viagem > passageiro > reserva/bilhete/PDV-formas de pagamento > emitir bilhete >
escolher poltrona (opcional) > financeiro
```

E fez a pergunta certa: **"onde eu reservo uma passagem?"**

A resposta que o plano adota: **o PDV é o lugar único da venda**, e chega-se a ele por três
portas, todas terminando no mesmo lugar.

```
CRM (oportunidade ganha)  ─┐
Atendimento no balcão      ├─→  PDV  ─→  reserva  ─→  bilhete  ─→  financeiro
Lançamento manual         ─┘            (poltrona opcional aqui ou pelo link público)
```

- **Pela oportunidade ganha:** o botão "Concretizar venda" abre o PDV já com cliente, viagem e
  valor preenchidos, e grava `oportunidadeId` na reserva para a abertura ser idempotente —
  dois cliques não podem gerar duas reservas. Esse cuidado já existe na cidadania
  (`processoId` no negócio) e serve de modelo.
- **Pelo balcão:** PDV direto, sem passar pelo funil. Venda presencial não deve ser obrigada a
  virar oportunidade antes.
- **Manual:** mesma tela, para lançar venda que aconteceu fora do sistema.

A poltrona fica **opcional no momento da venda**, porque nem sempre há veículo definido. Ela
pode ser escolhida no PDV ou depois, pelo link público que já existe.

---

## 6. Plano por fases

Ordem proposta por dependência e por valor. O dono decide a ordem final.

### F0 — Ajustes do que já existe (rápido, baixo risco)

- Semana do calendário começando no domingo.
- Frota para dentro de Configurações.
- Ordenação de poltrona que aguenta número com letra.
- `DespesaViagem` ganha data, tipo, responsável e a marca previsto × realizado (campos
  opcionais; despesa antiga continua válida).
- Trazer `lib/proximoPasso` da branch `deny-soma10` para a `main`.

### F1 — Cliente, documento e link público

- **Cliente separado de contato.** Lead continua no CRM; quem comprou vira cliente com ficha
  própria: documentos, histórico de viagens, preferências, restrições, contato de emergência.
- **Documento com as duas datas** (expedição e vencimento) para RG e passaporte, virando
  alerta no painel e pendência no manifesto.
- **Link público de cadastro** depois da compra: o passageiro preenche os próprios dados e
  anexa documento. Reusa o token de reserva que já existe.

### F2 — PDV de viagem e bilhete

- Tela de venda: viagem → passageiros → tarifa por passageiro → poltrona (opcional) → extras →
  desconto → forma de pagamento → confirmação.
- **Bilhete** com marca da Deny, passageiro, viagem, data, embarque, poltrona, valor, status do
  pagamento e QR Code; impressão, PDF e envio por WhatsApp.
- Entradas: oportunidade ganha, balcão e manual.

### F3 — Orçamento e cotação

- **Orçamento de pacote** e **orçamento de fretamento**, cada um com o seu formulário.
- **Status** (rascunho, enviado, visto, aprovado, expirado, recusado) e **validade de 7 dias**
  com expiração automática, aviso ao vendedor e opção de renovar.
- **PDF a partir de layout importado**: a Deny sobe o modelo dela e o sistema preenche. A infra
  de PDF já existe no repositório.
- Fretamento com campo livre do gestor para o descritivo do roteiro e dos itens inclusos.

### F4 — CRM mensal e o laço com a venda

- Visualização **mensal** do funil, além do kanban.
- Valor da oportunidade integrado ao valor da viagem.
- **Oportunidade ganha vira pré-reserva** na viagem, abrindo o PDV.

### F5 — Operação da viagem

- **Mapa de ocupação**: visão geral de livre, reservada, paga, bloqueada, cortesia, embarcada.
- **Check-in de embarque** por poltrona, com a lista na mão do guia.
- **Acompanhamento da viagem**: viagem em andamento, ocorrências, avisos ao grupo.
- **Despesas extras** lançadas durante a viagem, fechando o resultado real contra o previsto.

### F6 — Contrato e hospedagem

- **Contrato por viagem**, puxando roteiro, inclusos, forma de pagamento, data de redação e
  validade até o retorno da viagem. Modelo cadastrável com campos variáveis.
- **Rooming list** por hotel: distribuição de quartos, exportação e envio.

---

## 7. Decisões que dependem do dono

1. **Funil do CRM.** A especificação de setembro pede 10 estágios; hoje são 6, com ~192
   oportunidades dentro deles. O mapa de-para está pronto e nenhum negócio se move de lugar,
   só muda o nome da coluna. Faltam duas respostas: "Follow Up" é o mesmo que "Aguardando
   retorno"? Separar **Perdida** de **Cancelada** muda a prática de vocês?

2. **Separação da Deny.** O projeto publica da `main` até hoje; desde 01/10 chegaram 29 commits
   da agência e da clínica, nenhum tocando turismo. A branch limpa a criar sai da `main` do dia.

3. **Layout do orçamento.** O modelo que a Deny usa hoje, em arquivo, para o sistema preencher.

4. **Regras comerciais que viram campo:** prazo e condição de cancelamento, política de
   alteração, faixa etária de criança e gratuidade, condição de grupo.

5. **Numeração de bilhete e de orçamento.** Sequencial por ano, por viagem ou contínuo.

---

## 8. Método: do Lovable ao código real

O que funcionou no Agency e na Clínica:

1. **Inventário antes de desenhar.** Cada tela que for redesenhada ganha a lista do que ela faz
   hoje, com o checklist "não pode sumir". O risco do redesenho é função sumir na cópia, e não
   dado se perder.
2. **O Lovable desenha telas.** Mandar para ele a estrutura da tela, os campos e os estados.
   Não mandar o banco, a autenticação nem as integrações.
3. **A paleta entra pelos tokens.** Os 37 tokens `--v2-*` de `app/globals.css` são o caminho da
   cor e da tipografia. Amarelo `#FFC00F` já é a cor de marca do sistema.
4. **Uma tela por vez**, conferida no harness com o componente real antes de subir.
5. **Endereço de teste antes do oficial**, com a equipe da Deny aprovando.
6. **Rollback da Vercel** como rede de segurança.

### O que mandar para o Lovable primeiro

As telas que nascem agora, sem legado a preservar: **PDV**, **bilhete**, **orçamento**,
**ficha do cliente**, **mapa de ocupação** e **check-in**. São desenho novo, e é onde o Lovable
rende mais. As telas existentes (funil, croqui, calendário, frota) entram depois, com
inventário na mão.
