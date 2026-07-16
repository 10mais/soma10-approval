// Seed da Biblioteca de Vendas — perfil AGÊNCIA DE MARKETING DIGITAL (Grupo 10+).
//
// Conteúdo de partida para quem vende social media, tráfego pago, branding e
// sites para PMEs. É editável: a equipe refina com o que funciona na boca dela.
//
// Convenções do texto:
// - Placeholders {nome}, {primeiro}, {sdr}, {empresa} são trocados na hora do envio.
// - [colchetes] marcam o que o vendedor PRECISA preencher com dado real (case,
//   número, nome de cliente). Nunca inventar resultado.

import type { BibliotecaSeed } from '@/lib/bibliotecaVendas'

export const SEED_MARKETING: BibliotecaSeed = {
  objecoes: [
    {
      nome: 'Preço e investimento',
      respostas: [
        {
          titulo: 'Devolver para o valor',
          contexto: 'Primeira reação ao preço, antes de o lead entender o que está incluso.',
          texto: 'Entendo, {primeiro}. Só que preço sozinho não diz muita coisa: o que pesa é quanto isso precisa trazer de volta pra fazer sentido. Se o seu ticket médio é [valor], bastam [número] clientes novos no mês pra conta fechar. Faz sentido a gente olhar esse número junto?',
        },
        {
          titulo: 'Comparação com o custo interno',
          contexto: 'Quando o lead compara o valor da agência com o salário de uma pessoa.',
          texto: 'Boa comparação. Só que uma pessoa interna te dá um par de mãos; aqui você tem designer, redator, gestor de tráfego e estratégia no mesmo pacote, sem encargo e sem férias. Quer que eu te mostre o que entra no mês pra você comparar item a item?',
        },
        {
          titulo: 'Fatiar o investimento',
          contexto: 'O lead quer, mas o valor cheio trava o caixa dele agora.',
          texto: 'Tranquilo. A gente não precisa começar com tudo. Dá pra iniciar por [social media ou tráfego] e ir agregando conforme o retorno aparece. Prefere começar mais enxuto e crescer, ou prefere ver a proposta cheia primeiro?',
        },
        {
          titulo: 'Barato sai caro',
          contexto: 'Quando o lead recebeu um orçamento bem mais baixo de outra pessoa.',
          texto: 'Existe orçamento mais barato, sim, e é honesto dizer que existe. A diferença costuma aparecer no que não está no papel: quem responde quando dá problema, quem pensa a estratégia, quem cuida do seu perfil quando o mês aperta. Quer que eu te mostre onde os dois orçamentos divergem?',
        },
        {
          titulo: 'Custo de não fazer nada',
          contexto: 'Lead com verba, mas que trata marketing como gasto adiável.',
          texto: 'Deixa eu te fazer uma pergunta ao contrário, {primeiro}: quanto está custando ficar mais seis meses como está hoje? Enquanto o seu perfil fica parado, o cliente da sua região está achando o concorrente. Esse custo não vem na fatura, mas vem.',
        },
        {
          titulo: 'Separar honorário de mídia',
          contexto: 'O lead somou o valor do serviço com a verba de anúncio e assustou.',
          texto: 'Acho que ficou uma coisa misturada aí. O valor do 10+ é o trabalho: estratégia, criação e gestão. A verba de anúncio é sua, fica na sua conta e você define quanto colocar. São dois bolsos diferentes. Quer que eu separe isso na proposta pra ficar claro?',
        },
        {
          titulo: 'Preço por entregável',
          contexto: 'Quando o lead acha caro mas nunca viu o volume real do que recebe.',
          texto: 'Olha só o que entra no mês: [X posts, Y stories, campanhas, relatório]. Dividindo pelo que é entregue, o valor de cada peça fica em [valor]. Aí a conversa muda de "é caro" para "vale a pena". Quer que eu detalhe o pacote?',
        },
        {
          titulo: 'Marketing é ativo, não despesa',
          contexto: 'Perfil mais analítico, dono que pensa em investimento e retorno.',
          texto: 'Uma coisa que vale considerar: o que a gente constrói fica seu. Marca, conteúdo, base de seguidores, aprendizado das campanhas. Anúncio você liga e desliga, mas a estrutura permanece. É diferente de pagar aluguel de audiência todo mês.',
        },
        {
          titulo: 'Ancorar no que ele já gasta',
          contexto: 'Quando o lead já investe em mídia tradicional ou em algo que rende pouco.',
          texto: 'Você comentou que investe em [rádio, panfleto, patrocínio]. Quanto disso você consegue medir hoje? Aqui você vê o que cada real trouxe. Não é gastar mais, {primeiro}, é enxergar melhor pra onde o dinheiro está indo.',
        },
        {
          titulo: 'Assumir o não pelo preço',
          contexto: 'Última cartada quando o valor realmente não cabe. Encerra sem queimar.',
          texto: 'Se hoje o valor não cabe, tudo bem, prefiro ser honesto a te empurrar algo que aperte o seu caixa. Posso te deixar uma sugestão do que dá pra fazer sozinho por enquanto e a gente se fala quando fizer sentido. Combinado?',
        },
      ],
    },
    {
      nome: 'Vou pensar / me manda no WhatsApp',
      respostas: [
        {
          titulo: 'Descobrir o que ficou solto',
          contexto: 'Logo depois do "vou pensar", antes de aceitar o adiamento.',
          texto: 'Claro, {primeiro}, pensar é justo. Só me ajuda numa coisa: o que ficou pendente na sua cabeça? Se for o valor, a gente conversa. Se for a confiança na entrega, eu te mostro trabalho pronto. Assim eu não fico te enchendo à toa.',
        },
        {
          titulo: 'Combinar o retorno com data',
          contexto: 'O lead vai pensar de verdade, mas some se você não marcar o próximo passo.',
          texto: 'Perfeito. Pra eu não ficar te perseguindo: te chamo na [dia] à tarde pra saber o que você concluiu? Se até lá você decidir que não é agora, é só me dizer e eu respeito numa boa.',
        },
        {
          titulo: 'Mandar, mas com pergunta',
          contexto: 'O lead pediu material no WhatsApp. Manda, só que sem virar catálogo mudo.',
          texto: 'Mando sim. Só pra eu não te enviar um monte de coisa que não interessa: o seu foco agora é aparecer mais na região ou é vender direto pelo perfil? Aí eu te mando exatamente o que fala do seu caso.',
        },
        {
          titulo: 'PDF não decide nada',
          contexto: 'Quando o lead usa o "me manda por escrito" pra encerrar a conversa.',
          texto: 'Eu te mando, {primeiro}, mas vou ser sincero: proposta em PDF costuma ficar parada. Em dez minutos de conversa eu te mostro a tela, você pergunta o que quiser e sai com a decisão tomada, seja sim ou não. Tem dez minutos amanhã?',
        },
        {
          titulo: 'Pensar sobre o quê',
          contexto: 'Lead que já entendeu tudo e mesmo assim adia. Um empurrão respeitoso.',
          texto: 'A gente já falou de escopo, prazo e valor. Sobre qual desses três você quer pensar mais? Me diz qual é e eu te ajudo a pensar junto, é melhor do que você ficar sozinho com a dúvida.',
        },
        {
          titulo: 'Medo de errar de novo',
          contexto: 'Quando você sente que o lead já se queimou com fornecedor antes.',
          texto: 'Percebi um pé atrás e eu entendo. Muita gente já pagou por promessa bonita e não viu nada. Por isso a gente trabalha com entrega visível: você aprova cada post e vê o relatório. Se não gostar, você vê antes de o dinheiro sumir.',
        },
        {
          titulo: 'Reduzir o tamanho do sim',
          contexto: 'O lead trava porque contrato mensal parece um compromisso grande demais.',
          texto: 'Não precisa decidir o ano todo hoje. Decide o primeiro mês. Se no fim dele você não sentir diferença na sua rotina e no seu perfil, a gente conversa de novo sem drama. Topa começar pequeno?',
        },
        {
          titulo: 'Áudio que reabre',
          contexto: 'Depois de 2 a 3 dias de silêncio pós-material enviado.',
          texto: '{primeiro}, tudo bem? Te mandei a proposta na [dia] e não quero ficar no vácuo nem te encher. Só me responde com um número: 1 se ainda faz sentido, 2 se ficou pra depois. Qualquer um dos dois está ótimo pra mim.',
        },
        {
          titulo: 'Trocar o material por uma ligação',
          contexto: 'Lead que pede material toda vez e nunca abre.',
          texto: 'Já te mandei material antes e a gente acabou não conversando. Que tal invertermos? Cinco minutos no telefone, eu te falo os pontos principais e você me diz se serve. Se não servir, paro de te mandar coisa. Pode ser hoje às [hora]?',
        },
        {
          titulo: 'Deixar a porta encostada',
          contexto: 'Quando o lead insiste em pensar e você decide encerrar sem forçar.',
          texto: 'Fechado, {primeiro}. Não vou te pressionar. Vou seguir por aqui e, se aparecer alguma coisa do seu segmento que valha, eu te mando sem compromisso. Quando quiser retomar é só chamar, a porta fica aberta.',
        },
      ],
    },
    {
      nome: 'Já tenho agência ou faço interno',
      respostas: [
        {
          titulo: 'Perguntar antes de atacar',
          contexto: 'Primeira resposta. Nunca falar mal de quem está lá.',
          texto: 'Que bom que você já cuida disso, sério. E o que está funcionando melhor com eles hoje? Pergunto porque, se estiver redondo, eu prefiro não tomar seu tempo. Se tiver algum ponto te incomodando, aí a gente conversa.',
        },
        {
          titulo: 'Achar o incômodo',
          contexto: 'O lead tem agência mas o tom deixa escapar insatisfação.',
          texto: 'Deixa eu chutar: o que costuma incomodar não é o conteúdo em si, é a demora pra responder e o post que sai sem cara da empresa. Acontece algo assim aí? Se não acontece, ótimo, você está bem servido.',
        },
        {
          titulo: 'Não roubar, complementar',
          contexto: 'Quando a agência atual entrega bem uma frente e nada nas outras.',
          texto: 'Não estou aqui pra tirar ninguém. Se eles cuidam bem do conteúdo e o tráfego está solto, dá pra a gente pegar só o tráfego e trabalhar junto. Como está dividido hoje?',
        },
        {
          titulo: 'Interno sem tempo',
          contexto: 'Quando quem faz é a filha, a recepcionista, o próprio dono.',
          texto: 'Entendo, e olha, tem muito mérito nisso. O problema costuma ser que essa pessoa tem outra função e o marketing sobra pro fim do dia. Aí sai post na correria. Isso acontece aí ou vocês conseguem manter o ritmo?',
        },
        {
          titulo: 'Segunda opinião de graça',
          contexto: 'Lead satisfeito, mas aberto a ouvir. Entra como consultor, não vendedor.',
          texto: 'Se estiver funcionando, não mexe. Só te ofereço uma coisa: eu olho seu perfil e suas campanhas e te digo em cinco minutos o que eu faria diferente. Sem custo e sem compromisso. Se não tiver nada relevante, eu mesmo te falo.',
        },
        {
          titulo: 'Prova de estratégia',
          contexto: 'Quando a agência atual só posta e não pensa.',
          texto: 'Uma pergunta que separa muita coisa: eles te apresentam um plano do mês antes de postar, ou os posts simplesmente aparecem? Ter conteúdo é fácil. Ter direção é o que faz o conteúdo virar cliente.',
        },
        {
          titulo: 'Relatório existe?',
          contexto: 'Ótima para leads de tráfego pago que estão com outro fornecedor.',
          texto: 'Você recebe relatório de quanto cada campanha custou e quantos contatos trouxe? Se recebe, top, é sinal de casa arrumada. Se não recebe, você está pagando por algo que não consegue medir, e isso me preocuparia.',
        },
        {
          titulo: 'Agência de fora da região',
          contexto: 'Quando o fornecedor atual é de outra cidade e nunca pisou lá.',
          texto: 'Eles já foram aí conhecer a operação? Faz diferença. A gente é de Santo Ângelo, entende o público da região, sabe o que move a cidade. Conteúdo genérico até roda, mas não conversa com quem compra de você.',
        },
        {
          titulo: 'Ficar na fila com dignidade',
          contexto: 'Contrato vigente que o lead não vai romper agora.',
          texto: 'Justo, contrato é contrato. Quando ele vence? Anoto aqui e te chamo um mês antes, sem insistir até lá. Assim você compara com calma e decide com informação, não na pressa.',
        },
        {
          titulo: 'Trocar dói, mas parar dói mais',
          contexto: 'Lead insatisfeito que tem preguiça da transição.',
          texto: 'Sei que trocar dá trabalho: passar acesso, explicar tudo de novo. Só que ficar mais um ano com algo que não te traz cliente dá mais trabalho ainda, só que devagar. A transição a gente conduz, é uma semana. Vale conversar?',
        },
      ],
    },
    {
      nome: 'Não é o momento',
      respostas: [
        {
          titulo: 'Entender que momento é esse',
          contexto: 'Resposta padrão de abertura, antes de aceitar ou rebater.',
          texto: 'Entendi, {primeiro}. Só me ajuda: não é o momento por causa de caixa, de agenda ou porque tem outra prioridade na frente? Cada um desses tem uma conversa diferente, e talvez nenhuma seja agora mesmo.',
        },
        {
          titulo: 'Marketing tem tempo de maturação',
          contexto: 'Lead que quer esperar a temporada boa chegar pra começar.',
          texto: 'Faz sentido esperar. Só que resultado de marketing não é interruptor: leva algumas semanas pra engrenar. Se você quer estar forte em [mês de pico], começar em [mês atual] é o que dá tempo. Senão a temporada chega e você ainda está aquecendo.',
        },
        {
          titulo: 'Movimento fraco é o argumento',
          contexto: 'Quando o lead diz que o movimento caiu e por isso vai esperar.',
          texto: 'Deixa eu te devolver de outro jeito: o movimento está fraco e a solução é esperar ele melhorar sozinho? Normalmente é exatamente aí que marketing pesa mais. Não digo pra investir alto, digo pra não ficar parado esperando.',
        },
        {
          titulo: 'Começar pelo alicerce',
          contexto: 'Lead sem caixa pra pacote cheio, mas que precisa de base.',
          texto: 'Se agora não dá pra rodar tudo, dá pra deixar a casa pronta: perfil arrumado, marca definida, página no ar. Quando a verba liberar, você liga a chave e já está tudo em pé. Quer ver o que caberia nessa primeira fase?',
        },
        {
          titulo: 'Quando volta a ser momento',
          contexto: 'Aceite honesto do não. Serve pra qualificar o follow-up.',
          texto: 'Tranquilo. Só pra eu te procurar na hora certa e não antes: o que precisa acontecer aí pra virar prioridade? [Fechar o balanço, contratar alguém, passar a obra]? Me diz e eu anoto pra te chamar quando for.',
        },
        {
          titulo: 'O concorrente não esperou',
          contexto: 'Segmento onde há concorrente ativo e visível. Use com fato real.',
          texto: 'Uma coisa só, sem querer criar urgência falsa: [concorrente da região] está anunciando forte desde [período]. Quem está aparecendo agora está pegando a busca de quem vai comprar daqui a três meses. É um ponto pra pesar na decisão.',
        },
        {
          titulo: 'Ficar no radar',
          contexto: 'Lead legítimo, mas fora de janela. Encerra bem e mantém o vínculo.',
          texto: 'Fechado, {primeiro}. Não vou insistir. Vou te mandar de vez em quando alguma ideia do seu segmento, sem cobrança. Se um dia virar prioridade, você já sabe onde me achar.',
        },
        {
          titulo: 'Testar a firmeza do não',
          contexto: 'Quando "não é o momento" soa mais como educação do que como verdade.',
          texto: 'Posso te fazer uma pergunta direta? Se o investimento fosse metade do que a gente falou, seria o momento? Não é proposta, é só pra eu entender se a trava é o dinheiro ou se é a ideia mesmo. Prefiro saber.',
        },
        {
          titulo: 'Momento de obra ou mudança',
          contexto: 'Empresa em reforma, mudança de endereço ou reestruturação.',
          texto: 'Aí faz total sentido esperar mesmo. E te digo mais: reabertura é um dos melhores momentos pra marketing. Vale a gente conversar umas semanas antes de você reabrir, pra chegar com movimento no primeiro dia. Quando é a previsão?',
        },
        {
          titulo: 'Fim de ano e começo de ano',
          contexto: 'Lead que quer empurrar tudo para janeiro.',
          texto: 'Entendo querer deixar pra virada. Só que em janeiro todo mundo começa junto e a fila fica cheia. Se você fechar o planejamento agora, janeiro já começa rodando em vez de começar em reunião. Quer que eu te reserve a vaga?',
        },
      ],
    },
    {
      nome: 'Não tenho tempo para acompanhar',
      respostas: [
        {
          titulo: 'É justamente o ponto',
          contexto: 'Resposta principal. O lead confundiu contratar com ter mais trabalho.',
          texto: '{primeiro}, é exatamente por isso que a gente existe. Você não vai ter que acompanhar: a gente planeja, produz e publica. O que sobra pra você é aprovar num clique, do celular. Se virar mais uma tarefa na sua lista, a gente errou.',
        },
        {
          titulo: 'Quanto tempo de verdade',
          contexto: 'Quando o lead imagina que vai consumir horas da semana dele.',
          texto: 'Deixa eu colocar em número: o cliente médio nosso gasta uns [X minutos] por semana, e é só olhando o que a gente propôs e dizendo sim ou não. O resto corre sem você. Isso cabe na sua semana?',
        },
        {
          titulo: 'Aprovação pelo celular',
          contexto: 'Lead que se lembra de fornecedor antigo pedindo material o tempo todo.',
          texto: 'Você recebe os posts prontos num link, dá uma olhada na fila do banco ou no cafezinho e aprova. Sem grupo de WhatsApp bagunçado, sem ficar caçando arquivo. Quer que eu te mostre a tela rapidinho?',
        },
        {
          titulo: 'O material a gente resolve',
          contexto: 'O lead teme ter que produzir foto, vídeo e texto.',
          texto: 'Você não precisa virar produtor de conteúdo. A gente vai aí, faz a captação de uma vez e isso alimenta várias semanas. Fora isso, o que a gente pede é pouca coisa e sempre com antecedência.',
        },
        {
          titulo: 'Só uma pessoa fala com você',
          contexto: 'Lead que já se perdeu falando com cinco pessoas diferentes na agência anterior.',
          texto: 'Uma coisa que ajuda muito: você tem um responsável só. Não é central de atendimento, não é revezamento. Fala com a mesma pessoa, que já conhece a sua empresa. Isso poupa metade do tempo que você teme perder.',
        },
        {
          titulo: 'Delegar a decisão',
          contexto: 'Dono muito ocupado que tem alguém de confiança na operação.',
          texto: 'Se a sua agenda não permite mesmo, dá pra colocar alguém do seu time como aprovador e você entra só nas decisões maiores. Tem alguém aí que poderia ser essa ponte?',
        },
        {
          titulo: 'Sem tempo é sintoma',
          contexto: 'Quando falta de tempo é a real dor do negócio, não uma desculpa.',
          texto: 'Vou te falar o óbvio: você não tem tempo porque está fazendo tudo. Marketing entra justamente pra tirar uma frente do seu colo, não pra somar. Se depois de dois meses você não sentir isso, a gente rediscute.',
        },
        {
          titulo: 'Relatório que se lê em um minuto',
          contexto: 'Lead que teme reunião longa e planilha gigante.',
          texto: 'Nada de reunião de duas horas. Você recebe um resumo do mês com o que foi feito, o que deu resultado e o que a gente vai mudar. Lê em um minuto. Se quiser conversar, a gente conversa; se não quiser, está tudo ali.',
        },
        {
          titulo: 'A primeira semana é a mais pesada',
          contexto: 'Honestidade sobre o onboarding, pra não vender facilidade demais.',
          texto: 'Sendo honesto: no começo eu vou precisar de você. Uma conversa boa pra entender o negócio e uma captação. Depois disso a coisa roda quase sozinha. É um investimento de tempo no início pra você não precisar pensar nisso todo mês.',
        },
        {
          titulo: 'Aprovação em lote',
          contexto: 'Lead com rotina imprevisível que não consegue responder no dia a dia.',
          texto: 'Se a sua semana é imprevisível, a gente manda o mês inteiro de uma vez. Você senta uma hora, aprova tudo e o mês está resolvido. Alguns clientes preferem assim. Funciona melhor pra você?',
        },
      ],
    },
    {
      nome: 'Preciso falar com meu sócio/esposa',
      respostas: [
        {
          titulo: 'Entender quem é o outro',
          contexto: 'Primeira resposta. Descobre se é decisor real ou escudo.',
          texto: 'Claro, decisão de dois se toma junto mesmo. Só me ajuda a te ajudar: o que costuma pesar mais pra ele, o valor ou o resultado? Assim eu te passo a informação certa pra essa conversa.',
        },
        {
          titulo: 'Chamar o sócio para a mesa',
          contexto: 'Melhor caminho quando o outro sócio é decisor de verdade.',
          texto: 'Posso te sugerir uma coisa? Em vez de você ter que explicar tudo de novo, a gente faz uma conversa rápida com vocês dois. Quinze minutos. Ele pergunta direto e você não vira intérprete. Quando vocês dois têm um tempo?',
        },
        {
          titulo: 'Munir o mensageiro',
          contexto: 'Quando o outro decisor não vai participar de reunião de jeito nenhum.',
          texto: 'Beleza, então deixa eu te dar munição. Vou te mandar em três linhas: o que a gente faz, quanto custa e o que vocês recebem por mês. Sem enrolação, do jeito que dá pra ler em trinta segundos. Ajuda?',
        },
        {
          titulo: 'Testar a opinião dele',
          contexto: 'Meio da conversa. Descobre se o lead está a favor antes de virar recado.',
          texto: 'Antes de você falar com ele, me diz uma coisa: você está convencido? Porque se você ainda tem dúvida, ela vai junto na conversa e a resposta já sai não. O que ainda te deixa em cima do muro?',
        },
        {
          titulo: 'Antecipar a objeção dele',
          contexto: 'Prepara o lead pro contra-argumento que ele vai ouvir em casa.',
          texto: 'Deixa eu adivinhar o que ele vai dizer: "a gente já tentou isso e não deu em nada" ou "não é hora". Se vier alguma dessas, me chama que eu te ajudo a responder. Não quero que a ideia morra por falta de informação.',
        },
        {
          titulo: 'Marcar o retorno',
          contexto: 'Sempre. O "vou falar com ele" sem data vira sumiço.',
          texto: 'Fechado. Quando vocês conversam? [Hoje à noite, no fim de semana]? Aí eu te chamo na [dia seguinte] pra saber o que saiu. Se a resposta for não, também me diz, tá? Prefiro um não a um sumiço.',
        },
        {
          titulo: 'Sócio que é o financeiro',
          contexto: 'Quando o outro decisor cuida do caixa e olha só o número.',
          texto: 'Se ele é quem olha o dinheiro, ele vai querer saber de retorno, não de post bonito. Então leva esse recorte: com ticket de [valor], precisa de [número] clientes no mês pra pagar. Esse é o argumento que fala a língua dele.',
        },
        {
          titulo: 'Esposa ou marido no negócio',
          contexto: 'Negócio familiar, onde a decisão passa pelo casal.',
          texto: 'Entendo, em negócio de família isso se decide em casa mesmo, e é o certo. Só uma coisa: se ela quiser participar da conversa, é super bem-vinda. Muita gente decide melhor ouvindo direto do que por recado.',
        },
        {
          titulo: 'Escudo educado',
          contexto: 'Quando você suspeita que o sócio é desculpa pra não dizer não.',
          texto: 'Posso ser direto? Se o não for seu e não dele, pode falar tranquilo. Eu não vou insistir e não vou levar pro pessoal. Prefiro um não claro hoje a te perseguir por duas semanas.',
        },
        {
          titulo: 'Decisão que não precisa ser dos dois',
          contexto: 'Quando o valor é pequeno perto do porte da empresa.',
          texto: 'Uma pergunta sincera: pra um investimento desse tamanho, você precisa mesmo da aprovação dele, ou é uma decisão que cabe no seu campo? Pergunto porque, se couber, a gente resolve hoje e você mostra o resultado depois.',
        },
      ],
    },
  ],

  cadencias: [
    {
      nome: 'Social Media',
      descricao: 'Para leads que precisam de presença digital: perfil parado, conteúdo sem constância ou marca sem cara.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Primeiro contato com observação',
          contexto: 'Primeira mensagem, depois de olhar o perfil do lead de verdade.',
          texto: 'Oi, {nome}, tudo bem? Aqui é o {sdr}, do Grupo 10+, agência de Santo Ângelo. Dei uma olhada no perfil da {empresa} e vi que o último post foi em [mês]. Posso te mandar duas ideias rápidas do que eu faria aí?',
        },
        {
          fase: 'abordagem',
          titulo: 'Segundo toque com elogio real',
          contexto: 'Se não respondeu em 2 dias. Elogio precisa ser verdadeiro.',
          texto: '{primeiro}, passei aqui de novo. Achei muito bom o [detalhe real do negócio: a loja, o serviço, um post]. É o tipo de coisa que rende conteúdo e quase ninguém mostra. Faz sentido a gente trocar uma ideia?',
        },
        {
          fase: 'qualificacao',
          titulo: 'Quem cuida disso hoje',
          contexto: 'Assim que o lead responde. Descobre a situação antes de propor.',
          texto: 'Boa, obrigado por responder. Me conta: hoje quem cuida do Instagram da {empresa}? É você, alguém do time ou está com alguma agência? Pergunto pra não te propor algo que você já tem.',
        },
        {
          fase: 'qualificacao',
          titulo: 'O que o perfil precisa fazer',
          contexto: 'Depois de entender quem cuida. Define o objetivo antes de falar de entrega.',
          texto: 'E o que você espera do perfil, {primeiro}? Tem gente que quer aparecer e ser lembrada na região; tem gente que quer o cliente chamando no direct pra comprar. São caminhos diferentes. Qual é o seu?',
        },
        {
          fase: 'interesse',
          titulo: 'Constância vale mais que post bonito',
          contexto: 'Lead que já postou por conta própria e desanimou.',
          texto: 'Uma coisa que quase ninguém fala: o que faz perfil crescer não é o post genial, é a constância. Postar bem toda semana, sempre. É difícil sozinho porque a operação come o dia. É aí que a gente entra.',
        },
        {
          fase: 'interesse',
          titulo: 'Mostrar trabalho do segmento',
          contexto: 'Quando o lead demonstra curiosidade e você tem case do nicho.',
          texto: 'Olha o perfil de [cliente do mesmo segmento], que a gente cuida. Repara no padrão visual e no ritmo das publicações. É esse tipo de casa arrumada que a gente monta. Quer que eu te mostre o que a gente faria com a sua marca?',
        },
        {
          fase: 'agendamento',
          titulo: 'Convite para o diagnóstico',
          contexto: 'Depois de qualificar e gerar interesse. Chama pra conversa.',
          texto: '{primeiro}, o melhor caminho é a gente sentar vinte minutos, eu te mostrar o que vi no seu perfil e o que faria diferente. Sem compromisso. Prefere [dia] de manhã ou [dia] à tarde?',
        },
        {
          fase: 'agendamento',
          titulo: 'Confirmação véspera',
          contexto: 'Um dia antes da reunião marcada. Evita o furo.',
          texto: 'Oi, {primeiro}, tudo certo pra amanhã às [hora]? Vou levar uma análise do seu perfil e umas ideias de conteúdo pra {empresa}. Se precisar remarcar, me avisa sem problema.',
        },
        {
          fase: 'fechamento',
          titulo: 'Proposta com próximo passo',
          contexto: 'Logo depois da reunião, no mesmo dia.',
          texto: 'Foi ótimo conversar, {primeiro}. Segue a proposta com o que combinamos: [pacote]. Se estiver de acordo, a gente já agenda a captação de fotos pra [semana] e o primeiro conteúdo sai em [prazo]. O que acha?',
        },
        {
          fase: 'fechamento',
          titulo: 'Empurrão final honesto',
          contexto: '3 a 4 dias depois da proposta, sem retorno.',
          texto: '{primeiro}, só pra não deixar isso morrer no vácuo. Se ficou alguma dúvida na proposta, me fala que eu ajusto. Se não for agora, também está tudo bem, é só me dizer que eu paro por aqui numa boa.',
        },
      ],
    },
    {
      nome: 'Tráfego Pago',
      descricao: 'Para quem já vende e quer volume: anúncios no Meta e no Google com verba, meta e relatório.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Abertura com anúncio identificado',
          contexto: 'Quando você viu o lead anunciando (biblioteca de anúncios) ou parou de anunciar.',
          texto: 'Oi, {nome}, aqui é o {sdr}, do Grupo 10+. Vi que a {empresa} está anunciando [ou anunciou até pouco tempo]. Trabalho com gestão de tráfego aqui na região e queria te fazer uma pergunta rápida sobre isso, posso?',
        },
        {
          fase: 'abordagem',
          titulo: 'Abertura para quem nunca anunciou',
          contexto: 'Negócio com movimento mas sem anúncio nenhum rodando.',
          texto: 'Oi, {nome}, tudo bem? {sdr}, do Grupo 10+. Reparei que a {empresa} não está anunciando. Pra um negócio de [segmento] em [cidade], isso normalmente é dinheiro deixado na mesa. Te mando um exemplo rápido do que dá pra fazer?',
        },
        {
          fase: 'qualificacao',
          titulo: 'De onde vem o cliente hoje',
          contexto: 'Primeira pergunta de qualificação. Base de tudo.',
          texto: 'Antes de falar de anúncio: hoje, de onde vem a maior parte dos seus clientes? Indicação, passagem na rua, redes? Preciso saber o que já funciona pra não estragar o que está de pé.',
        },
        {
          fase: 'qualificacao',
          titulo: 'Verba e capacidade',
          contexto: 'Segunda pergunta. Descobre se cabe e se a operação aguenta.',
          texto: 'E duas coisas práticas: você já tem uma ideia de quanto poderia colocar por mês em anúncio? E se chegar o dobro de contato amanhã, a sua equipe dá conta de atender? Já vi campanha boa virar problema por causa disso.',
        },
        {
          fase: 'interesse',
          titulo: 'Anúncio mede, o resto adivinha',
          contexto: 'Lead que investe em mídia tradicional ou só em indicação.',
          texto: 'A diferença do anúncio pro resto é essa: você sabe quanto custou cada contato. Panfleto e rádio você paga e torce. Aqui a gente vê o número, corta o que não anda e reforça o que traz. É investimento com painel.',
        },
        {
          fase: 'interesse',
          titulo: 'Verba mal usada não é culpa do anúncio',
          contexto: 'Lead que já impulsionou post e diz que não funcionou.',
          texto: 'Muita gente diz que anúncio não funciona depois de impulsionar post pelo botão. Só que ali você paga por curtida, não por cliente. Campanha estruturada mira quem está querendo comprar [serviço] agora. É outro jogo.',
        },
        {
          fase: 'agendamento',
          titulo: 'Chamar para ver os números',
          contexto: 'Lead qualificado e interessado. Convite objetivo.',
          texto: '{primeiro}, vamos fazer assim: vinte minutos e eu te mostro quanto custa em média um contato no seu segmento por aqui e quanto de verba faria sentido pra {empresa}. Você decide depois. [Dia] às [hora] serve?',
        },
        {
          fase: 'agendamento',
          titulo: 'Reforço com dado da região',
          contexto: 'Lead que não respondeu ao convite. Usa dado real, nunca inventado.',
          texto: '{primeiro}, levantei aqui quanto o [segmento] anda pagando por contato na nossa região. É um número que te ajuda a decidir mesmo que você não feche comigo. Vale os vinte minutos? Me diz um horário que eu me encaixo.',
        },
        {
          fase: 'fechamento',
          titulo: 'Proposta com plano de largada',
          contexto: 'Depois da reunião, com verba e meta já conversadas.',
          texto: 'Segue a proposta, {primeiro}. Plano: começamos com [verba] por mês, [X campanhas], e no primeiro mês a gente testa pra achar o que funciona. Relatório toda [periodicidade]. Se aprovar, os acessos a gente pede amanhã e sobe na [semana].',
        },
        {
          fase: 'fechamento',
          titulo: 'Fechamento pelo custo do atraso',
          contexto: 'Proposta parada há alguns dias, com o lead ainda interessado.',
          texto: '{primeiro}, cada semana parada é uma semana de aprendizado que a campanha não teve. Quanto antes sobe, antes ela fica boa. Se o que trava é algum ponto da proposta, me diz qual que eu resolvo hoje.',
        },
      ],
    },
    {
      nome: 'Site / Landing Page',
      descricao: 'Para quem não tem site, tem um site velho ou precisa de página de captura para campanha.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Abertura por site ausente ou velho',
          contexto: 'Primeiro contato. Cite o que você viu de fato.',
          texto: 'Oi, {nome}, tudo bem? {sdr}, do Grupo 10+, de Santo Ângelo. Procurei a {empresa} no Google e cheguei só no Instagram [ou num site de [ano]]. Isso costuma custar cliente. Posso te mostrar o que eu faria em dois minutos?',
        },
        {
          fase: 'abordagem',
          titulo: 'Abertura pelo celular',
          contexto: 'Quando o site existe mas abre mal no celular.',
          texto: '{nome}, abri o site da {empresa} pelo celular e ele [demora pra carregar / fica desconfigurado]. Como quase todo mundo entra pelo celular hoje, esse detalhe pesa. Quer que eu te mande o print do que vi?',
        },
        {
          fase: 'qualificacao',
          titulo: 'O site precisa fazer o quê',
          contexto: 'Primeira pergunta. Separa site institucional de página de venda.',
          texto: 'Antes de qualquer coisa: o que você espera do site? Ser a vitrine que dá credibilidade quando alguém pesquisa a {empresa}, ou uma página que capta contato de campanha? São projetos bem diferentes.',
        },
        {
          fase: 'qualificacao',
          titulo: 'Material e prazo',
          contexto: 'Segunda pergunta. Levanta o que já existe e a urgência.',
          texto: 'E o que você já tem na mão? Logo, fotos, textos, domínio? Quanto mais coisa pronta, mais rápido sai. Tem alguma data que precisa estar no ar, tipo [feira, lançamento, temporada]?',
        },
        {
          fase: 'interesse',
          titulo: 'O cliente pesquisa antes',
          contexto: 'Lead que acha que Instagram basta.',
          texto: 'Instagram é ótimo pra ser encontrado, mas quem vai gastar um valor maior pesquisa a empresa no Google antes de decidir. Se não acha nada, dá insegurança. O site é o que confirma que a {empresa} é séria.',
        },
        {
          fase: 'interesse',
          titulo: 'Landing existe para converter',
          contexto: 'Lead que vai rodar tráfego e quer mandar tudo pro WhatsApp.',
          texto: 'Se você vai anunciar, mandar todo mundo direto pro WhatsApp queima verba: chega muita gente sem contexto. Uma página que explica e filtra faz o contato chegar mais quente. Melhora o resultado do mesmo dinheiro.',
        },
        {
          fase: 'agendamento',
          titulo: 'Conversa de escopo',
          contexto: 'Depois de entender objetivo e material.',
          texto: 'Vamos marcar meia hora, {primeiro}? Eu te mostro dois ou três sites que a gente fez pra [segmento] e a gente desenha a estrutura do seu ali na conversa. Você já sai sabendo prazo e valor. [Dia] às [hora]?',
        },
        {
          fase: 'agendamento',
          titulo: 'Referência antes da reunião',
          contexto: 'Lead frio no convite. Manda algo concreto pra puxar o sim.',
          texto: '{primeiro}, te mando o link de [site de cliente do mesmo segmento] pra você ver o padrão de acabamento. Dá uma olhada com calma e, se gostar, a gente marca a conversa. Se não for o seu estilo, me fala também que eu ajusto.',
        },
        {
          fase: 'fechamento',
          titulo: 'Proposta com cronograma',
          contexto: 'Depois da reunião. Prazo é o que fecha site.',
          texto: 'Segue a proposta, {primeiro}. Escopo: [páginas]. Prazo: [X semanas] a partir do envio do material. Aprovando hoje, a gente entra em [data] e entrega em [data]. Combina com o que você precisa?',
        },
        {
          fase: 'fechamento',
          titulo: 'Destravar a última dúvida',
          contexto: 'Proposta enviada e silêncio. Vai direto ao ponto.',
          texto: '{primeiro}, normalmente o que segura um projeto de site é uma de duas coisas: o prazo ou o valor. Qual das duas é aqui? Me diz qual e eu vejo o que dá pra fazer. Se for nenhuma das duas, me conta qual é que eu resolvo.',
        },
      ],
    },
  ],

  roteiros: [
    {
      nome: 'Clínica / Estética',
      descricao: 'Qualificação para clínicas médicas, odontológicas, estéticas e consultórios.',
      perguntas: [
        {
          pergunta: 'Quantos profissionais atendem na clínica hoje e quais procedimentos são o carro-chefe?',
          contexto: 'Define o porte e o que o marketing precisa empurrar. Clínica de um profissional tem teto de agenda.',
          seSim: 'Anote os dois ou três procedimentos mais rentáveis: é neles que a campanha vai focar.',
          seNao: 'Se ele não sabe o que vende mais, sinal de gestão fraca. Investigue antes de propor tráfego.',
        },
        {
          pergunta: 'A agenda está cheia hoje ou tem buraco durante a semana?',
          contexto: 'Marketing para clínica lotada é outra conversa: vira posicionamento e ticket, não volume.',
          seSim: 'Agenda cheia: proponha marca, ticket maior e procedimentos de maior margem, não mais volume.',
          seNao: 'Agenda com buraco: aí tráfego pago faz sentido imediato. Levante os dias e horários vazios.',
        },
        {
          pergunta: 'Como o paciente chega até vocês hoje?',
          contexto: 'Se é tudo indicação, existe um teto natural. Mostrar esse teto é o que abre a conversa.',
          seSim: 'Se é indicação: mostre que indicação é ótima mas não escala e depende da sorte do mês.',
          seNao: 'Se já vem de rede ou anúncio: pergunte quanto custa cada paciente novo hoje.',
        },
        {
          pergunta: 'Quem atende o WhatsApp e quanto tempo leva pra responder?',
          contexto: 'Campanha de clínica morre no atendimento. Sem resposta rápida, a verba vira contato perdido.',
          seSim: 'Tem alguém dedicado: ótimo, a campanha vai render. Confirme o horário de cobertura.',
          seNao: 'Ninguém dedicado: trate isso ANTES de vender tráfego, ou o resultado não aparece e a culpa cai na agência.',
          parada: 'Se ninguém responde o WhatsApp e não há disposição de mudar isso, não venda tráfego. Ofereça conteúdo e volte depois.',
        },
        {
          pergunta: 'Qual o ticket médio de um paciente novo e quanto ele vale ao longo do tempo?',
          contexto: 'É a conta que justifica o investimento. Sem esse número, todo preço parece caro.',
          seSim: 'Com o número na mão, faça a conta ao vivo: quantos pacientes pagam o investimento.',
          seNao: 'Ajude a estimar na hora. Se ele não faz ideia, o problema é anterior ao marketing.',
        },
        {
          pergunta: 'Vocês trabalham com o conselho de classe pesando na comunicação?',
          contexto: 'CFM, CFO e afins limitam promessa, antes e depois e promoção. Precisa entrar no plano desde o início.',
          seSim: 'Explique que a gente já produz dentro das regras do conselho. Isso costuma ser um alívio pro médico.',
          seNao: 'Se ele quer o que a regra proíbe, alinhe agora. Melhor perder a venda do que gerar problema ético.',
          parada: 'Se ele exige comunicação que fere o conselho e não aceita orientação, não avance.',
        },
        {
          pergunta: 'Você já investiu em marketing antes? Como foi?',
          contexto: 'Revela mágoas e expectativas irreais. Clínica é o segmento mais queimado por promessa fácil.',
          seSim: 'Pergunte o que especificamente frustrou. Use isso para posicionar a diferença, sem falar mal de ninguém.',
          seNao: 'Nunca investiu: baixe a expectativa de velocidade e explique a maturação.',
        },
        {
          pergunta: 'Você tem alguma resistência em aparecer em vídeo ou foto?',
          contexto: 'Em clínica, o profissional é a marca. Se ele não aparece, o conteúdo perde muita força.',
          seSim: 'Aparece: excelente, planeje captação regular. É o maior diferencial que ele tem.',
          seNao: 'Não aparece: proponha alternativas (equipe, estrutura, bastidor), mas avise que o alcance é menor.',
        },
        {
          pergunta: 'Quem decide sobre o investimento? É você sozinho ou tem sócio?',
          contexto: 'Clínica com vários sócios trava por meses. Melhor saber no primeiro contato.',
          seSim: 'Decisor único: siga para o agendamento da proposta.',
          seNao: 'Tem sócios: peça para incluir o decisor na próxima conversa.',
          parada: 'Se o decisor nunca aparece e nunca há data para reunião de sócios, pare de investir tempo.',
        },
        {
          pergunta: 'Quanto você imagina reservar por mês pra isso?',
          contexto: 'Fecha a qualificação. Sem verba nenhuma, todo o resto é conversa fiada.',
          seSim: 'Verba compatível: agende a apresentação da proposta.',
          seNao: 'Verba abaixo do mínimo: ofereça o escopo enxuto ou seja honesto e encerre bem.',
          parada: 'Sem qualquer verba disponível nos próximos meses: encerre com elegância e coloque no reaquecimento.',
        },
      ],
    },
    {
      nome: 'Comércio local / Varejo',
      descricao: 'Qualificação para lojas, mercados, restaurantes e comércio de rua da região.',
      perguntas: [
        {
          pergunta: 'Sua venda é mais no balcão, no WhatsApp ou online?',
          contexto: 'Define o objetivo da campanha: levar gente à loja é diferente de vender pela internet.',
          seSim: 'Balcão: foque em alcance local, horário e localização. Meta na região, raio curto.',
          seNao: 'Online ou WhatsApp: aí entra catálogo, página e campanha de conversão.',
        },
        {
          pergunta: 'Qual produto ou linha traz mais margem hoje?',
          contexto: 'Anunciar o que vende sozinho é desperdício. O marketing tem que empurrar o que dá lucro.',
          seSim: 'Anote e construa a campanha em cima disso, não em cima do que já sai.',
          seNao: 'Se ele não sabe a margem por linha, comece pela conversa de gestão antes da campanha.',
        },
        {
          pergunta: 'Seu movimento tem época boa e época fraca?',
          contexto: 'Sazonalidade define calendário e verba. Varejo erra ao anunciar só quando já está cheio.',
          seSim: 'Monte o calendário com antecedência: aquecer antes do pico e sustentar no vale.',
          seNao: 'Movimento constante: foque em recorrência e ticket, não em pico.',
        },
        {
          pergunta: 'Você tem cadastro dos seus clientes ou eles compram e somem?',
          contexto: 'Base de clientes é o ativo mais barato do varejo e quase ninguém usa.',
          seSim: 'Tem base: proponha reaquecimento e campanha para quem já comprou. Retorno rápido e barato.',
          seNao: 'Não tem: a primeira entrega pode ser justamente começar a captar contato no balcão.',
        },
        {
          pergunta: 'Quem tira as fotos dos produtos hoje?',
          contexto: 'Varejo vive de imagem. Foto ruim derruba qualquer campanha, por melhor que seja a mira.',
          seSim: 'Tem foto boa: agilize, o projeto anda rápido.',
          seNao: 'Não tem: inclua captação no escopo e alinhe que isso é parte do custo e do prazo.',
        },
        {
          pergunta: 'Como está a concorrência aí na sua rua ou no seu segmento?',
          contexto: 'Varejo local é briga de vizinhança. Saber quem anuncia muda a estratégia.',
          seSim: 'Concorrente ativo: mostre a biblioteca de anúncios dele e o que ele está fazendo.',
          seNao: 'Ninguém anuncia: ótimo argumento, o campo está aberto e o custo por contato tende a ser menor.',
        },
        {
          pergunta: 'Se chegarem trinta pedidos a mais na semana, você entrega?',
          contexto: 'Campanha que estoura a operação vira reclamação. É melhor descobrir antes.',
          seSim: 'Dá conta: siga em frente com confiança.',
          seNao: 'Não dá: comece pequeno, com verba controlada, e cresça junto com a capacidade.',
          parada: 'Se o estoque ou a equipe não sustentam nem o movimento atual, não venda campanha de volume agora.',
        },
        {
          pergunta: 'Você já impulsionou post pelo botão do Instagram?',
          contexto: 'Quase todo varejista já fez. Serve para explicar a diferença sem soar teórico.',
          seSim: 'Já fez: pergunte quanto gastou e o que voltou. Aí explique a diferença de campanha estruturada.',
          seNao: 'Nunca fez: melhor ainda, não tem vício nem frustração pra desfazer.',
        },
        {
          pergunta: 'Quem decide aqui é você mesmo?',
          contexto: 'Em comércio familiar a decisão costuma ser de duas ou três pessoas.',
          seSim: 'Decisor: avance para a proposta.',
          seNao: 'Peça para trazer quem decide para a conversa, em vez de virar recado.',
          parada: 'Se o decisor nunca está disponível e o contato não tem autonomia nenhuma, não invista mais tempo.',
        },
        {
          pergunta: 'Quanto dá pra investir por mês sem apertar o caixa?',
          contexto: 'Varejo tem margem apertada. Vender acima do que ele suporta gera cancelamento em dois meses.',
          seSim: 'Cabe: siga para a proposta e defina a divisão entre serviço e mídia.',
          seNao: 'Não cabe: proponha o pacote de entrada ou encerre bem.',
          parada: 'Se não sobra nada e o negócio está em dificuldade real, seja honesto: não é hora. Guarde para o reaquecimento.',
        },
      ],
    },
    {
      nome: 'Indústria / B2B',
      descricao: 'Qualificação para indústrias, distribuidoras, cooperativas e prestadores que vendem para empresas.',
      perguntas: [
        {
          pergunta: 'Quem é o seu cliente: consumidor final, revenda ou outra indústria?',
          contexto: 'Muda tudo. B2B tem ciclo longo, poucos decisores e conteúdo técnico.',
          seSim: 'B2B puro: esqueça volume de seguidor. Foque em autoridade, LinkedIn, site e geração de contato qualificado.',
          seNao: 'Se vende também ao consumidor final, separe as duas frentes desde já.',
        },
        {
          pergunta: 'Quanto tempo leva, em média, da primeira conversa até fechar um contrato?',
          contexto: 'Alinha expectativa. Se o ciclo é de seis meses, cobrar resultado em trinta dias é injusto.',
          seSim: 'Ciclo longo: contrate a expectativa junto. O indicador do começo é contato qualificado, não venda.',
          seNao: 'Ciclo curto: dá pra medir resultado mais cedo e o tráfego rende mais rápido.',
        },
        {
          pergunta: 'Você tem equipe comercial ou o dono é quem vende?',
          contexto: 'Sem quem receba e trabalhe o contato, campanha B2B não se converte em nada.',
          seSim: 'Tem equipe: pergunte se eles têm processo e onde registram os contatos.',
          seNao: 'Dono vende tudo: o gargalo é o tempo dele. Marketing vai gerar contato que ele não vai conseguir atender.',
          parada: 'Se não há ninguém para atender contato novo e o dono está saturado, resolva isso antes de gerar demanda.',
        },
        {
          pergunta: 'Quanto vale um contrato médio pra vocês?',
          contexto: 'Em B2B o ticket alto justifica investimento maior. É o melhor argumento de valor que existe.',
          seSim: 'Ticket alto: mostre que um único contrato paga meses de trabalho. A conta se defende sozinha.',
          seNao: 'Se ele não sabe: ajude a estimar. Sem isso não há como discutir investimento com racionalidade.',
        },
        {
          pergunta: 'Hoje vocês participam de feira, catálogo ou representante?',
          contexto: 'Indústria já investe em canais tradicionais. O digital entra apoiando, não substituindo.',
          seSim: 'Já investe: posicione o digital como o que dá continuidade entre uma feira e outra.',
          seNao: 'Não investe em nada: a base ainda precisa ser construída. Comece pelo site e pela apresentação.',
        },
        {
          pergunta: 'Quando alguém pesquisa vocês no Google, o que encontra?',
          contexto: 'Comprador B2B pesquisa antes de responder. Site fraco derruba negócio grande.',
          seSim: 'Encontra site bom: ótimo, dá pra partir direto para geração de demanda.',
          seNao: 'Encontra pouco ou nada: a prioridade é site e presença, antes de qualquer campanha.',
        },
        {
          pergunta: 'Vocês têm material técnico, fotos da fábrica, do processo?',
          contexto: 'É o conteúdo que gera autoridade em B2B. Sem material, o custo e o prazo do projeto sobem.',
          seSim: 'Tem material: acelera muito. Peça acesso já.',
          seNao: 'Não tem: inclua captação e produção no escopo, com prazo realista.',
        },
        {
          pergunta: 'Quem toma a decisão de contratar marketing aí?',
          contexto: 'Indústria tem diretoria, conselho, cooperativa tem assembleia. Ciclo de decisão longo.',
          seSim: 'Decisor à mesa: siga para a proposta formal.',
          seNao: 'Mapeie o caminho: quem aprova, quando reúnem, o que costuma pesar.',
          parada: 'Se a decisão depende de uma instância que não reúne nos próximos meses, coloque no reaquecimento e siga.',
        },
        {
          pergunta: 'Vocês têm meta de crescimento pra este ano?',
          contexto: 'Amarra o marketing a um objetivo que já existe. Vira meio, não gasto novo.',
          seSim: 'Tem meta: amarre a proposta a ela. O investimento vira parte do plano, não linha solta.',
          seNao: 'Sem meta: o marketing vai ser sempre a primeira coisa cortada. Sinal de risco.',
        },
        {
          pergunta: 'Existe verba prevista ou isso ainda precisa entrar no orçamento?',
          contexto: 'Em empresa estruturada, verba não prevista significa esperar o próximo ciclo.',
          seSim: 'Verba prevista: acelere, o caminho está aberto.',
          seNao: 'Precisa entrar no orçamento: descubra quando fecha o orçamento e agende para antes disso.',
          parada: 'Se não há verba e nem previsão de orçamento, pare a venda e mantenha o relacionamento até a próxima janela.',
        },
      ],
    },
  ],

  reaquecimento: {
    leads: [
      {
        nome: 'Orçamento parado há 3+ meses',
        quando: 'Lead recebeu proposta, achou interessante e nunca respondeu. Sem contato há três meses ou mais.',
        mensagens: [
          {
            titulo: 'Retomada sem cobrança',
            contexto: 'Primeira mensagem. Sem culpa, sem "sumiu".',
            texto: 'Oi, {primeiro}, tudo bem? Aqui é o {sdr}, do Grupo 10+. A gente conversou lá em [mês] sobre [serviço] pra {empresa}. Não vim cobrar resposta, vim só saber como andam as coisas por aí. Deu pra tocar esse assunto?',
          },
          {
            titulo: 'Trazer algo novo',
            contexto: 'Se respondeu ou se ficou no silêncio por 3 a 4 dias. Precisa ter motivo real.',
            texto: 'Te chamei porque mudou uma coisa desde a nossa conversa: [novidade real, novo formato, resultado de cliente do segmento]. Lembrei de você por causa de [ponto que ele levantou na época]. Quer que eu te mostre?',
          },
          {
            titulo: 'Proposta atualizada',
            contexto: 'Lead voltou a responder e demonstrou interesse.',
            texto: 'A proposta de [mês] está desatualizada, {primeiro}. Deixa eu refazer com o que faz sentido hoje pra {empresa}? Não é a mesma coisa de antes, e o seu negócio também mudou nesse tempo. Vinte minutos e eu te apresento.',
          },
          {
            titulo: 'Encerramento honesto',
            contexto: 'Sem resposta após as três tentativas. Fecha o ciclo com dignidade.',
            texto: '{primeiro}, imagino que não seja prioridade agora e está tudo bem. Vou parar de te chamar sobre isso. Se um dia mudar, é só me dar um toque, que eu retomo na hora. Sucesso aí com a {empresa}.',
          },
        ],
      },
      {
        nome: 'Sumiu depois da proposta',
        quando: 'Lead engajado que leu a proposta, respondeu bem e parou de responder de uma hora para outra.',
        mensagens: [
          {
            titulo: 'Assumir a falha',
            contexto: 'Primeira mensagem. Tirar o peso do lead costuma destravar resposta.',
            texto: '{primeiro}, tudo bem? Fiquei pensando aqui: acho que a proposta que te mandei ficou longa demais e não respondeu o que você realmente queria saber. Foi isso ou era outra coisa? Pode ser sincero, me ajuda.',
          },
          {
            titulo: 'Pergunta de um toque',
            contexto: 'Segunda tentativa, 3 dias depois. Facilita ao máximo a resposta.',
            texto: 'Pra facilitar, {primeiro}: me responde só com um número. 1 = ainda quero, só está corrido. 2 = ficou pra mais pra frente. 3 = não vai rolar. Qualquer um serve, eu respeito os três.',
          },
          {
            titulo: 'Última porta',
            contexto: 'Terceira e última mensagem, uma semana depois. Encerra sem ressentimento.',
            texto: 'Fechado, {primeiro}, entendo o silêncio como "não é hora" e paro por aqui. Foi bom conversar de qualquer forma. Se a {empresa} precisar de marketing em algum momento, você sabe onde me achar. Abraço.',
          },
        ],
      },
      {
        nome: 'Base fria de 1 ano',
        quando: 'Contatos antigos do CRM, sem interação há um ano ou mais. A pessoa pode nem lembrar do 10+.',
        mensagens: [
          {
            titulo: 'Reapresentação curta',
            contexto: 'Primeira mensagem. Assume que ele não lembra de você.',
            texto: 'Oi, {nome}! Aqui é o {sdr}, do Grupo 10+, agência de Santo Ângelo. A gente trocou uma ideia lá em [ano] sobre marketing pra {empresa}. Provavelmente você nem lembra, e tudo bem. Ainda faz sentido falar disso aí?',
          },
          {
            titulo: 'Entregar antes de pedir',
            contexto: 'Se respondeu, mesmo que morno. Dá algo de valor sem cobrar nada.',
            texto: 'Legal saber. Olha, dei uma olhada rápida no perfil da {empresa} e anotei três coisas que eu ajustaria, coisa simples, que você mesmo consegue fazer. Quer que eu te mande? Sem compromisso nenhum.',
          },
          {
            titulo: 'Convite leve',
            contexto: 'Depois de entregar valor e receber retorno positivo.',
            texto: 'Que bom que serviu, {primeiro}. Se você quiser, a gente marca vinte minutos e eu te mostro o quadro completo do que dá pra fazer aí. Você decide depois com calma. Tem um horário essa semana?',
          },
        ],
      },
    ],
    clientes: [
      {
        nome: 'Cliente que pausou o contrato',
        quando: 'Ex-cliente que encerrou por caixa, troca de gestão ou reestruturação, e saiu em bons termos.',
        mensagens: [
          {
            titulo: 'Contato sem agenda',
            contexto: 'Primeira mensagem, cerca de dois meses após a saída. Só relacionamento.',
            texto: 'Oi, {primeiro}, tudo bem? Aqui é o {sdr}. Sem assunto comercial, prometo: só passei pra saber como está a {empresa} depois daquela fase. Deu pra ajeitar as coisas por aí?',
          },
          {
            titulo: 'Observação útil',
            contexto: 'Se respondeu bem. Você conhece o negócio dele, use isso a favor.',
            texto: 'Que bom ouvir isso. Passei no perfil de vocês e reparei que [observação real e gentil]. Como a gente cuidou disso um tempo, bateu vontade de comentar. Se quiser, te mando o que eu retomaria primeiro.',
          },
          {
            titulo: 'Convite para retomar',
            contexto: 'Se ele demonstrou abertura. Facilita a volta sem parecer recomeço.',
            texto: '{primeiro}, se em algum momento fizer sentido retomar, a nossa vantagem é que a gente não começa do zero: já conhece a {empresa}, a marca e o que funcionou. Dá pra voltar num formato mais leve também. Quer que eu monte uma opção?',
          },
        ],
      },
      {
        nome: 'Nova oferta para quem já foi cliente',
        quando: 'Lançamento de serviço novo ou formato novo que o ex-cliente não chegou a usar.',
        mensagens: [
          {
            titulo: 'Convite pela novidade',
            contexto: 'Primeira mensagem. O serviço novo precisa ser aderente ao negócio dele.',
            texto: 'Oi, {primeiro}! {sdr} aqui. A gente começou a trabalhar com [serviço novo] no 10+ e, sinceramente, a {empresa} foi a primeira que me veio à cabeça por causa de [motivo concreto]. Posso te contar em dois minutos?',
          },
          {
            titulo: 'Explicar o encaixe',
            contexto: 'Se ele demonstrou curiosidade. Conecta o serviço à dor que ele já teve.',
            texto: 'Lembra que na época o [problema real que ele viveu] te incomodava? É exatamente isso que esse formato resolve. Não é o mesmo pacote de antes com nome novo, é outra coisa. Quer ver como ficaria no seu caso?',
          },
          {
            titulo: 'Condição de quem já foi de casa',
            contexto: 'Se houver condição real aprovada. Nunca prometa desconto sem autorização.',
            texto: 'E como você já foi de casa, a gente pula toda a parte de conhecer o negócio, o que encurta o começo. Consigo te fazer uma condição de entrada em [condição real]. Vale uma conversa de vinte minutos?',
          },
        ],
      },
      {
        nome: 'Pesquisa de satisfação que reabre a conversa',
        quando: 'Ex-cliente que saiu com algum atrito ou sem explicação clara. A pesquisa é a porta de entrada honesta.',
        mensagens: [
          {
            titulo: 'Pedir o feedback de verdade',
            contexto: 'Primeira mensagem. Só funciona se você realmente quiser ouvir.',
            texto: 'Oi, {primeiro}. Aqui é o {sdr}, do 10+. Não é venda, é pedido de ajuda: você pode me dizer, com sinceridade, o que faltou no nosso trabalho pra {empresa}? Pode ser duro, prefiro assim. Serve pra gente melhorar de verdade.',
          },
          {
            titulo: 'Reconhecer e mostrar mudança',
            contexto: 'Depois do feedback. Só envie se a mudança for real e verificável.',
            texto: 'Obrigado por ser franco, {primeiro}. Isso que você apontou era um problema nosso mesmo, e a gente mudou: hoje [mudança real e concreta]. Não conserta o que passou, mas achei justo você saber que serviu pra alguma coisa.',
          },
          {
            titulo: 'Reabrir sem pressão',
            contexto: 'Última mensagem, só se a conversa terminou em bom tom.',
            texto: 'Não vou te propor nada agora, ficaria estranho. Só queria deixar registrado que a porta está aberta dos dois lados. Se um dia você quiser dar uma segunda chance, me chama. E se não quiser, também está tudo certo. Valeu de verdade.',
          },
        ],
      },
    ],
  },
}
