// Biblioteca de Vendas — perfil TURISMO (operadora de excursões rodoviárias).
//
// Conteúdo de partida para quem atende no balcão e no WhatsApp da operadora.
// Segue o processo da especificação SOMA10 da Deny Turismo: lead → viagem de
// interesse ou fretamento → cotação (válida por 7 dias) → reserva e pagamento →
// passageiros → documentos → poltrona → contrato e bilhete → embarque.
//
// REGRAS DE OURO (as mesmas dos outros nichos, adaptadas):
//   • nada de valor, data, horário ou condição inventados — o que é real entra
//     entre [colchetes] e quem atende preenche;
//   • uma ideia por mensagem, sempre devolvendo a palavra para a pessoa;
//   • nunca prometer o que a operação não controla (tempo, estrada, hotel cheio);
//   • excursão é compra de CONFIANÇA e quase sempre decidida a dois ou em grupo:
//     a objeção verdadeira raramente é preço, é medo de errar;
//   • cotação tem validade de 7 dias — isso é argumento honesto de urgência,
//     não pressão inventada.
//
// Placeholders: {primeiro} e {nome} (contato), {vendedor}, {empresa}.
// Tudo é editável na tela — é ponto de partida, não lei.

import type { BibliotecaSeed } from '@/lib/bibliotecaVendas'

export const SEED_TURISMO: BibliotecaSeed = {
  objecoes: [
    {
      nome: 'Preço e pagamento',
      respostas: [
        {
          titulo: 'Achei caro',
          contexto: 'A pessoa já viu o valor e reagiu ao número, sem comparar com nada.',
          texto: 'Entendo, {primeiro}. Deixa eu te mostrar o que está dentro desse valor: ônibus [tipo do veículo], [quantas] diárias de hotel [com/sem café], guia acompanhando o grupo o tempo todo, [passeios inclusos] e seguro. Se você fosse por conta própria, só hotel e combustível já passariam disso — e sem ninguém resolvendo as coisas para você. Quer que eu te mande a cotação detalhada para olhar com calma?',
        },
        {
          titulo: 'Vi mais barato em outra agência',
          contexto: 'Comparação de preço com concorrente, geralmente sem comparar o que está incluso.',
          texto: '{primeiro}, pode ser que seja mesmo mais barato — e também pode ser que não seja a mesma viagem. Me manda o que eles te passaram que eu comparo item a item com você, sem enrolação: tipo de ônibus, hotel, o que está incluso e o que vira custo extra no meio do caminho. Se a deles for melhor, eu te digo na lata.',
        },
        {
          titulo: 'Dá para parcelar?',
          contexto: 'Interesse real; o travamento é o caixa do mês.',
          texto: 'Dá sim, {primeiro}. A gente trabalha com entrada de [valor ou %] e o restante em até [n] vezes, a última parcela caindo [antes/depois] da viagem. Quer que eu monte a simulação com a sua data de preferência?',
        },
        {
          titulo: 'Tem desconto à vista?',
          contexto: 'A pessoa quer negociar antes de decidir.',
          texto: 'Para pagamento à vista eu consigo [condição real]. Mas antes de falar de desconto, me diz uma coisa: a viagem é essa mesmo que você quer? Porque desconto em viagem errada não resolve nada. Se for essa, eu já fecho a condição com você.',
        },
        {
          titulo: 'Criança paga o mesmo valor?',
          contexto: 'Família perguntando pela composição do preço.',
          texto: 'Não, {primeiro}. Criança até [idade] paga [valor/meia] e [até idade] é [gratuidade/condição], desde que [regra: no colo, sem poltrona, acompanhada]. Me diz as idades de quem vai que eu já te mando o valor fechado da família.',
        },
        {
          titulo: 'Quero saber o preço final, sem surpresa',
          contexto: 'Já se queimou antes com custo escondido.',
          texto: 'Justo. Na cotação eu separo em duas listas: o que está incluso e o que NÃO está — normalmente ficam de fora [refeições fora do hotel, ingressos opcionais, bebidas]. Assim você já sai sabendo quanto levar no bolso. Posso te mandar?',
        },
      ],
    },
    {
      nome: 'Decisão compartilhada',
      respostas: [
        {
          titulo: 'Vou ver com meu marido / minha esposa',
          contexto: 'A decisão é a dois e você está falando com só uma parte.',
          texto: 'Claro, {primeiro}, viagem é decisão de casal mesmo. Para você não ter que explicar tudo de cabeça, eu te mando a cotação com roteiro, valores e condições — aí vocês olham juntos. Uma coisa só: ela vale até [data], porque depois disso as poltronas voltam para a venda. Consegue conversar até lá?',
        },
        {
          titulo: 'Preciso ver com o grupo / a turma',
          contexto: 'Excursão de amigos, igreja, escola — quem fala não decide sozinho.',
          texto: 'Perfeito. Faz o seguinte: eu te mando a cotação em dois formatos — uma por pessoa, para você repassar no grupo, e uma com o total fechado. E me diz quantos são mais ou menos, porque a partir de [n] pessoas eu consigo [condição de grupo]. Quando vocês se falam?',
        },
        {
          titulo: 'Vou pensar',
          contexto: 'Resposta de corredor. Quase sempre esconde dúvida que não foi dita.',
          texto: 'Sem problema, {primeiro}. Só me ajuda com uma coisa, para eu não ficar te enchendo à toa: o que ficou te segurando foi o valor, a data ou alguma dúvida sobre a viagem em si? Me diz com sinceridade que eu te respondo e você pensa com a informação completa.',
        },
        {
          titulo: 'Depois eu te retorno',
          contexto: 'Encerrando a conversa sem compromisso.',
          texto: 'Combinado. Para eu não te atrapalhar nem te esquecer: posso te chamar [dia] para saber como ficou? Se até lá você decidir, é só me mandar um "quero" que eu seguro a poltrona na hora.',
        },
      ],
    },
    {
      nome: 'Medo, conforto e saúde',
      respostas: [
        {
          titulo: 'Viagem de ônibus é cansativa',
          contexto: 'Nunca foi de excursão ou foi numa ruim.',
          texto: 'Entendo, {primeiro}. O nosso é [tipo: leito / semileito / executivo], com [ar, banheiro, poltrona reclinável], e a gente para a cada [tempo] para esticar as pernas e comer. A maior parte do trecho longo é feita [de noite/de dia], então você [dorme e acorda lá / vai vendo a estrada]. Quer que eu te mande o roteiro com os horários e as paradas?',
        },
        {
          titulo: 'Tenho medo de passar mal na estrada',
          contexto: 'Enjoo, labirintite, ansiedade. É medo real, não desculpa.',
          texto: 'Isso é mais comum do que você imagina, {primeiro} — e tem jeito. A gente reserva as poltronas [da frente / sobre o eixo], que balançam menos, e o guia vai com você o tempo todo. Se você quiser, já deixo anotado no seu cadastro para a equipe ficar atenta. Qual costuma ser o problema: enjoo, tontura ou o ar?',
        },
        {
          titulo: 'Sou idoso / tenho problema de saúde',
          contexto: 'Precisa saber se a viagem comporta a condição dele.',
          texto: '{primeiro}, obrigado por me contar — isso me ajuda a te orientar direito. Me diz: você tem alguma limitação para caminhar ou subir escada? Pergunto porque [este roteiro tem/não tem] trechos a pé e o hotel [tem/não tem] elevador. Prefiro te dizer a verdade agora do que você descobrir lá.',
        },
        {
          titulo: 'Vou sozinho, e se eu não me enturmar?',
          contexto: 'Medo social — forte em quem viaja sozinho pela primeira vez.',
          texto: 'Olha, {primeiro}, metade do nosso ônibus costuma ser de gente que foi sozinha na primeira vez e hoje viaja com a gente sempre. O guia apresenta todo mundo logo na primeira parada e os grupos se formam sozinhos. Se quiser, te coloco numa poltrona [ao lado de outra pessoa sozinha / no corredor], o que você preferir.',
        },
        {
          titulo: 'Posso escolher minha poltrona?',
          contexto: 'Dúvida prática que vira critério de decisão para muita gente.',
          texto: 'Pode sim. Assim que a reserva é feita eu te mando o mapa do ônibus e você escolhe a sua pelo link — dá para ver quais já estão ocupadas. Quanto antes reservar, mais opção você tem. Quer que eu te mande agora como fica?',
        },
      ],
    },
    {
      nome: 'Confiança na empresa',
      respostas: [
        {
          titulo: 'Não conheço vocês',
          contexto: 'Primeiro contato vindo de anúncio ou indicação distante.',
          texto: 'Justo, {primeiro} — é dinheiro seu. A {empresa} roda [tempo] com excursões saindo de [cidade], somos [registro/cadastro na agência reguladora], e você pode ver os relatos de quem viajou aqui: [link do Instagram ou avaliações]. Se quiser, te mando fotos da última saída para [destino], com o grupo e o ônibus.',
        },
        {
          titulo: 'E se a viagem não sair?',
          contexto: 'Medo de perder o dinheiro numa excursão que não encheu.',
          texto: 'Pergunta certa. A viagem precisa de [mínimo] passageiros e a gente confirma até [prazo] antes da saída. Se não atingir, você escolhe: a gente devolve [100%/condição] ou troca por outra data sem custo. Isso está escrito no contrato, não é promessa de boca.',
        },
        {
          titulo: 'E se eu precisar cancelar?',
          contexto: 'Quer saber o risco antes de assinar.',
          texto: 'A regra é: cancelando até [prazo] antes, [condição]; depois disso, [condição]. Tem também a opção de transferir a sua vaga para outra pessoa, que muita gente usa. Tudo isso vai escrito no contrato que você recebe antes de pagar — leia com calma e me pergunte o que não ficar claro.',
        },
        {
          titulo: 'Preciso de nota fiscal / contrato',
          contexto: 'Empresa, escola ou quem presta conta a terceiros.',
          texto: 'Sem problema, {primeiro}. Emitimos [documento] e o contrato sai no nome [da pessoa ou do CNPJ], com o roteiro e as condições todas descritas. Me passa os dados de faturamento que eu já deixo pronto junto com a cotação.',
        },
      ],
    },
    {
      nome: 'Data, vaga e destino',
      respostas: [
        {
          titulo: 'Essa data não dá para mim',
          contexto: 'Quer o destino, não consegue o período.',
          texto: 'Me diz que período fecharia para você, {primeiro}. Esse mesmo destino costuma repetir em [época], e eu posso te avisar assim que a data abrir — você entra na frente da lista. Quer que eu te reserve esse lugar na fila?',
        },
        {
          titulo: 'Vou esperar para ver se abaixa',
          contexto: 'Acredita que preço de viagem cai perto da data.',
          texto: '{primeiro}, com excursão costuma ser o contrário: as primeiras poltronas saem na melhor condição e, quando a viagem enche, só sobra [categoria mais cara / nada]. Hoje eu ainda tenho [n] lugares. Se você reservar agora com [entrada], trava esse valor e paga o resto até [data].',
        },
        {
          titulo: 'Ainda falta muito para a viagem',
          contexto: 'Acha cedo para decidir.',
          texto: 'Entendo, mas é justamente agora que você escolhe a poltrona que quer e paga parcelado tranquilo — quem deixa para o fim paga de uma vez e senta onde sobrou. A reserva segura o seu lugar com [valor de entrada]. Faz sentido para você?',
        },
        {
          titulo: 'Está esgotada, e agora?',
          contexto: 'A viagem desejada não tem mais vaga.',
          texto: 'Essa fechou, {primeiro}, mas não desanima: eu te coloco na lista de espera (desistência acontece) e te mostro [outra data / destino parecido] que ainda tem lugar. Quer que eu te mande as duas opções?',
        },
      ],
    },
    {
      nome: 'Documentos e Mercosul',
      respostas: [
        {
          titulo: 'Preciso de passaporte?',
          contexto: 'Viagem a Argentina, Uruguai, Paraguai ou Chile.',
          texto: 'Para [país], brasileiro entra com [documento aceito] — não precisa de passaporte, desde que o documento esteja [em bom estado / dentro da validade]. O que derruba passageiro na fronteira é documento rasurado, muito antigo ou foto que não reconhece mais a pessoa. Me manda uma foto do seu que eu confiro antes.',
        },
        {
          titulo: 'Meu RG é antigo',
          contexto: 'Risco real de barra na fronteira.',
          texto: '{primeiro}, melhor resolver agora do que na divisa. A recomendação é documento emitido há menos de [tempo] e com foto reconhecível. Dá tempo de tirar a segunda via até [data da viagem]? Se não der, a gente vê [alternativa aceita].',
        },
        {
          titulo: 'Vou levar criança',
          contexto: 'Menor de idade — a regra muda conforme quem acompanha.',
          texto: 'Me diz quem viaja com a criança: pai, mãe, os dois ou outra pessoa? É isso que define o documento. Se não forem os dois responsáveis, precisa de [autorização], e para fora do país a exigência é [documento]. Eu te mando o modelo pronto e você só leva para assinar.',
        },
        {
          titulo: 'Esqueci de mandar os documentos',
          contexto: 'Cobrança de pendência documental sem constranger.',
          texto: 'Oi {primeiro}! Passando para lembrar dos documentos da viagem para [destino] — faltam [o que falta]. É o que eu preciso para montar a lista oficial e fechar o embarque. Pode mandar foto por aqui mesmo, do jeito que for mais fácil para você.',
        },
      ],
    },
    {
      nome: 'Fretamento e grupos',
      respostas: [
        {
          titulo: 'Quero só uma ideia de preço',
          contexto: 'Primeiro contato de fretamento, sem dados nenhum.',
          texto: 'Consigo sim, mas preciso de quatro coisas para não te dar número errado: de onde sai, para onde vai, quando (ida e volta) e quantas pessoas. Com isso eu te mando o valor fechado hoje mesmo. Pode me passar?',
        },
        {
          titulo: 'Vou cotar com outras empresas',
          contexto: 'Fretamento quase sempre vai a três cotações.',
          texto: 'Faz todo sentido, {primeiro}. Só um pedido: na hora de comparar, veja se a cotação do outro inclui [pedágio, hospedagem e alimentação do motorista, estacionamento e horas de espera] — é aí que a conta costuma mudar depois. A minha já vai com tudo embutido, sem surpresa no fim.',
        },
        {
          titulo: 'E se faltar gente no nosso grupo?',
          contexto: 'Responsável com medo de bancar a diferença.',
          texto: 'No fretamento o valor é do veículo, não por pessoa — então quanto mais gente, mais barato fica para cada um. Posso te montar a conta em duas faixas, [n] e [n] pessoas, para você mostrar ao grupo e decidir. Quer assim?',
        },
        {
          titulo: 'Precisa de ônibus adaptado',
          contexto: 'Acessibilidade — não prometer antes de confirmar a frota.',
          texto: 'Me conta o que a pessoa precisa: cadeira de rodas, dificuldade de subir degrau, espaço extra? Dependendo do caso eu uso [veículo] e [solução]. Não vou te prometer antes de confirmar com a operação — me dá [prazo] que eu te respondo com certeza.',
        },
      ],
    },
  ],

  cadencias: [
    {
      nome: 'Viagem própria — do primeiro contato à reserva',
      descricao: 'Lead que chegou por anúncio, Instagram, indicação ou balcão, interessado numa excursão do calendário.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Primeiro contato (lead do anúncio)',
          contexto: 'Logo após o lead entrar. Responder em minutos é o que mais converte aqui.',
          texto: 'Oi {primeiro}! Aqui é {vendedor}, da {empresa}. Vi que você se interessou pela viagem para [destino] em [data]. Me conta: a viagem seria para você sozinho, para o casal ou para a família?',
        },
        {
          fase: 'abordagem',
          titulo: 'Primeiro contato (indicação)',
          contexto: 'Quando o lead veio por quem já viajou com a operadora.',
          texto: 'Oi {primeiro}, tudo bem? Aqui é {vendedor}, da {empresa}. O(a) [quem indicou] me passou seu contato dizendo que você estava pensando em [destino]. Que bom! Me diz: você já tem data em mente ou está só pesquisando ainda?',
        },
        {
          fase: 'qualificacao',
          titulo: 'Quantas pessoas e quem viaja',
          contexto: 'Segunda ou terceira mensagem. Define preço, poltronas e quarto.',
          texto: 'Perfeito. Para eu montar o valor certinho: quantas pessoas vão no total e tem criança no grupo? Se tiver, me diz as idades — muda o valor e o quarto.',
        },
        {
          fase: 'qualificacao',
          titulo: 'Primeira excursão?',
          contexto: 'Saber se é a primeira vez muda TODO o resto da conversa.',
          texto: 'Me diz uma coisa, {primeiro}: você já viajou de excursão antes ou essa seria a primeira? Pergunto porque se for a primeira eu te explico direitinho como funciona o dia a dia da viagem, para você não ter surpresa.',
        },
        {
          fase: 'interesse',
          titulo: 'Mandar o roteiro antes do preço',
          contexto: 'Quando a pessoa ainda não se apaixonou pela viagem. Preço antes do desejo vira só número.',
          texto: '{primeiro}, antes de falar de valor quero te mostrar como é a viagem: [dia 1 — o quê], [dia 2 — o quê], [dia 3 — o quê]. O que mais te chamou atenção nesse roteiro?',
        },
        {
          fase: 'interesse',
          titulo: 'Prova social da última saída',
          contexto: 'Lead morno, já viu o roteiro, não respondeu.',
          texto: 'Oi {primeiro}! Acabou de voltar o grupo de [destino] — mandei algumas fotos aqui para você ver como foi. O próximo é [data] e ainda tem [n] poltronas. Quer que eu segure uma para você?',
        },
        {
          fase: 'agendamento',
          titulo: 'Enviar a cotação',
          contexto: 'Momento de mandar o PDF. Sempre dizendo a validade.',
          texto: '{primeiro}, segue a sua cotação para [destino], saindo em [data]: [valor] por pessoa, com [o que inclui]. Ela vale até [data +7 dias] — depois disso eu preciso refazer, porque as poltronas voltam para a venda. Qualquer dúvida me chama que eu explico item por item.',
        },
        {
          fase: 'agendamento',
          titulo: 'Confirmar que recebeu e entendeu',
          contexto: 'No dia seguinte ao envio da cotação.',
          texto: 'Oi {primeiro}, conseguiu abrir a cotação? Se quiser, eu te ligo [hoje/amanhã] e a gente passa junto item por item — é rápido e você tira todas as dúvidas de uma vez.',
        },
        {
          fase: 'fechamento',
          titulo: 'Segurar a poltrona',
          contexto: 'A pessoa demonstrou que quer, mas não fechou.',
          texto: '{primeiro}, com [valor da entrada] eu já reservo a sua poltrona e o restante você parcela até [data]. Assim você não corre o risco de a viagem encher. Quer que eu faça a reserva no seu nome?',
        },
        {
          fase: 'fechamento',
          titulo: 'Último dia da cotação',
          contexto: 'Véspera do vencimento dos 7 dias. Urgência verdadeira, não inventada.',
          texto: 'Oi {primeiro}! Sua cotação para [destino] vence amanhã. Posso renovar sem problema, só que o valor passa a ser o de hoje e sobraram [n] lugares. Quer que eu garanta o seu antes de vencer?',
        },
        {
          fase: 'fechamento',
          titulo: 'Depois de fechar — o próximo passo',
          contexto: 'Logo após o pagamento da entrada. É aqui que a venda vira operação.',
          texto: 'Fechado, {primeiro}! Sua reserva para [destino] está confirmada. Agora são três coisinhas rápidas: (1) te mandei o link para preencher os dados dos passageiros, (2) com ele você já escolhe as poltronas no mapa do ônibus, e (3) preciso dos documentos de cada um. Faz o primeiro agora que leva dois minutos?',
        },
      ],
    },
    {
      nome: 'Fretamento — grupo fechado',
      descricao: 'Empresa, escola, igreja, time ou turma que contrata o veículo inteiro.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Primeiro retorno ao pedido de orçamento',
          contexto: 'Chegou um pedido de fretamento com poucos dados.',
          texto: 'Oi {primeiro}, aqui é {vendedor}, da {empresa}. Recebi seu pedido de orçamento. Para eu fechar o valor certo, me confirma quatro coisas: saída de onde, destino, datas e horários de ida e volta, e quantas pessoas?',
        },
        {
          fase: 'qualificacao',
          titulo: 'Entender o grupo e a ocasião',
          contexto: 'O tipo de grupo muda veículo, horário e cuidado.',
          texto: 'Ótimo. E me diz: é grupo de [empresa, escola, igreja, time, família]? Pergunto porque muda bastante — [escola pede responsável e horário certo, time leva equipamento, excursão religiosa costuma ter idosos].',
        },
        {
          fase: 'qualificacao',
          titulo: 'Detalhes que mudam o preço',
          contexto: 'Antes de calcular. É o que evita cotação errada e briga depois.',
          texto: 'Mais três perguntas e eu já calculo: (1) o ônibus fica à disposição no destino ou só leva e busca? (2) tem pernoite — o motorista vai precisar de hospedagem? (3) alguém com necessidade de acessibilidade ou bagagem fora do normal?',
        },
        {
          fase: 'interesse',
          titulo: 'Quem decide e quando',
          contexto: 'Fretamento tem comitê. Perguntar isso cedo economiza semanas.',
          texto: '{primeiro}, só para eu me organizar: a decisão é sua ou passa por mais alguém? E vocês pretendem fechar até quando? Pergunto porque na data de vocês eu tenho [n] veículos e eles costumam ser pedidos com antecedência.',
        },
        {
          fase: 'agendamento',
          titulo: 'Enviar a proposta de fretamento',
          contexto: 'Envio do PDF com o valor fechado.',
          texto: '{primeiro}, segue a proposta para [trajeto] em [data]: [valor] pelo serviço completo, já com motorista, combustível, pedágio e [o que mais]. Vale até [data +7 dias]. Dei destaque ao que está incluso e ao que não está, para você comparar com qualquer outra sem susto depois.',
        },
        {
          fase: 'fechamento',
          titulo: 'Reservar o veículo na agenda',
          contexto: 'Proposta aprovada verbalmente, falta assinar.',
          texto: 'Para eu bloquear o veículo na agenda de [data] preciso de [entrada/assinatura]. Enquanto não entra, a data fica aberta para outros pedidos — e já tem gente perguntando esse fim de semana. Posso enviar o contrato para assinatura?',
        },
        {
          fase: 'fechamento',
          titulo: 'Depois de assinado — próximos passos',
          contexto: 'Transição da venda para a operação.',
          texto: 'Contrato assinado, {primeiro}! Agora preciso de duas coisas suas: a lista de passageiros com nome completo e documento (mando a planilha), e o ponto exato de embarque com o horário. Com isso eu fecho a escala e te mando o nome do motorista com antecedência.',
        },
      ],
    },
  ],

  roteiros: [
    {
      nome: 'Qualificação — passageiro de excursão',
      descricao: 'Para o primeiro atendimento de quem quer uma viagem do calendário. Vai até onde a conversa deixar: roteiro não é interrogatório.',
      perguntas: [
        {
          pergunta: 'A viagem é para você, para o casal ou para a família?',
          contexto: 'Abre a conversa e já define quartos, poltronas e valor.',
          seSim: 'Anote quantos e a relação entre eles — isso vira o quarto no rooming list.',
          parada: 'Se a pessoa só quer saber preço e não responde nada, mande o roteiro e a faixa de valor e combine um retorno.',
        },
        {
          pergunta: 'Tem criança ou alguém acima de [idade] no grupo?',
          contexto: 'Muda preço, documento e cuidado operacional.',
          seSim: 'Peça as idades. Criança muda o valor; idoso pede atenção a escada, caminhada e poltrona.',
        },
        {
          pergunta: 'Você já viajou de excursão antes?',
          contexto: 'A pergunta mais útil do roteiro. Primeira viagem exige explicar o básico.',
          seNao: 'Explique como funciona o dia da viagem: horário de embarque, paradas, bagagem, guia. É o que derruba o medo.',
          seSim: 'Pergunte do que ela mais gostou e do que não gostou — o "não gostei" te diz exatamente o que evitar e o que destacar.',
        },
        {
          pergunta: 'A data de [data] fecha para você ou precisa ser outro período?',
          contexto: 'Evita montar cotação de viagem que ela não pode fazer.',
          seNao: 'Ofereça a próxima saída do mesmo destino e registre o período possível para avisar quando abrir.',
          parada: 'Sem data possível nos próximos meses, pare a venda e coloque como reaquecimento futuro.',
        },
        {
          pergunta: 'De onde você embarcaria?',
          contexto: 'Ponto de embarque é critério de decisão e entra na lista oficial.',
          seNao: 'Se o ponto da pessoa não é atendido, verifique com a operação antes de prometer parada nova.',
        },
        {
          pergunta: 'Você prefere pagar à vista ou parcelado?',
          contexto: 'Depois do interesse, nunca antes. Define a condição que você vai propor.',
          seSim: 'Monte a simulação na hora e mande junto da cotação.',
        },
        {
          pergunta: 'Seus documentos estão em dia? (para viagem internacional)',
          contexto: 'Só para destino fora do país. Documento vencido descoberto tarde cancela passageiro.',
          seNao: 'Explique o prazo para tirar a segunda via e confira se dá tempo até a viagem.',
          parada: 'Se não dá tempo de regularizar, ofereça outra data em vez de vender e ter problema na fronteira.',
        },
        {
          pergunta: 'Posso te mandar a cotação agora?',
          contexto: 'Fecha a qualificação e inicia a validade de 7 dias.',
          seSim: 'Envie no mesmo dia, dizendo a data de validade, e agende o retorno para o dia seguinte.',
        },
      ],
    },
    {
      nome: 'Levantamento — fretamento',
      descricao: 'Tudo que precisa estar na mão antes de calcular um fretamento. Faltando um item, o valor sai errado e a conta aparece depois.',
      perguntas: [
        {
          pergunta: 'Quem é o contratante e quem é o responsável no dia?',
          contexto: 'Nem sempre é a mesma pessoa. O contrato vai em um nome; quem resolve na estrada é outro.',
        },
        {
          pergunta: 'Origem, destino e paradas no caminho?',
          contexto: 'Base da quilometragem, do combustível e do pedágio.',
          seSim: 'Anote as paradas com cidade — elas mudam o trajeto e o tempo do motorista.',
        },
        {
          pergunta: 'Datas e horários de saída e de retorno?',
          contexto: 'Define diária do motorista, pernoite e conflito de agenda do veículo.',
        },
        {
          pergunta: 'Quantas pessoas, aproximadamente?',
          contexto: 'Define o veículo. Diferença entre van e ônibus muda tudo.',
          seNao: 'Sem número nem aproximado, cote em duas faixas e deixe claro que o valor final depende disso.',
        },
        {
          pergunta: 'O veículo fica à disposição no destino?',
          contexto: 'Hora parada e deslocamento local são o que mais some das cotações mal feitas.',
          seSim: 'Levante quantas horas por dia e quais deslocamentos — isso é diária, não cortesia.',
        },
        {
          pergunta: 'Tem pernoite? O motorista precisa de hospedagem e alimentação?',
          contexto: 'Custo obrigatório e esquecido com frequência.',
        },
        {
          pergunta: 'Alguém com necessidade de acessibilidade? Bagagem fora do comum?',
          contexto: 'Equipamento de time, instrumento, cadeira de rodas — define o veículo.',
          parada: 'Se precisar de adaptação que a frota não tem, diga antes de cotar. Não prometa o que a operação não confirmou.',
        },
        {
          pergunta: 'Até quando vocês precisam da resposta e quem assina?',
          contexto: 'Fretamento tem comitê e prazo. Saber isso evita perder a data.',
        },
      ],
    },
  ],

  reaquecimento: {
    leads: [
      {
        nome: 'Cotação venceu sem resposta',
        quando: 'De 1 a 3 dias depois de a cotação expirar (7 dias do envio).',
        mensagens: [
          {
            titulo: 'Aviso do vencimento',
            contexto: 'No dia em que a cotação expira.',
            texto: 'Oi {primeiro}! Sua cotação para [destino] venceu hoje. Isso não é problema — eu refaço rapidinho. Só me diz se a viagem ainda está nos seus planos ou se prefere que eu te avise na próxima data.',
          },
          {
            titulo: 'Renovação com o que mudou',
            contexto: 'Dois dias depois, se não houve resposta.',
            texto: '{primeiro}, refiz a sua cotação para [destino]: hoje está [valor] e restam [n] poltronas. Se quiser, seguro uma para você por [prazo] sem compromisso de pagamento. É só me dizer.',
          },
        ],
      },
      {
        nome: 'Sumiu depois da proposta',
        quando: 'Entre 7 e 15 dias sem resposta após o envio da cotação.',
        mensagens: [
          {
            titulo: 'A pergunta honesta',
            contexto: 'Primeira tentativa de reabrir a conversa.',
            texto: 'Oi {primeiro}, tudo bem? Não quero te encher — só queria entender se a viagem para [destino] saiu dos planos ou se foi alguma coisa da proposta que não fechou. Pode ser sincero comigo que eu te ajudo de verdade.',
          },
          {
            titulo: 'Encerramento educado',
            contexto: 'Última mensagem antes de parar. Fechar bem deixa a porta aberta.',
            texto: '{primeiro}, vou parar de te chamar para não te incomodar. Deixo registrado o seu interesse por [destino] e, quando abrir data nova, te aviso em primeira mão. Se mudar de ideia antes, é só me chamar aqui. Boa viagem quando ela vier!',
          },
        ],
      },
      {
        nome: 'Perdeu a viagem que queria',
        quando: 'Logo depois de a saída desejada lotar ou partir.',
        mensagens: [
          {
            titulo: 'Lista de espera',
            contexto: 'Viagem esgotada e a pessoa ainda quer ir.',
            texto: 'Oi {primeiro}! A saída de [data] encheu, mas desistência acontece quase sempre. Te coloco na lista de espera? Se abrir, você é a primeira pessoa que eu chamo — sem compromisso nenhum agora.',
          },
          {
            titulo: 'Próxima data do mesmo destino',
            contexto: 'Quando a nova data entra no calendário.',
            texto: '{primeiro}, lembra que você queria [destino]? Abriu nova saída em [data] e eu separei para te avisar antes de divulgar. Quer que eu segure uma poltrona para você?',
          },
        ],
      },
      {
        nome: 'Base parada há meses',
        quando: 'Leads sem contato há 90 dias ou mais, de qualquer origem.',
        mensagens: [
          {
            titulo: 'Reaproximação pelo calendário',
            contexto: 'Começo de temporada ou lançamento do calendário novo.',
            texto: 'Oi {primeiro}! Saiu o calendário de viagens da {empresa} para [período] — tem [destino], [destino] e [destino]. Lembrei de você porque na época a gente conversou sobre [destino]. Quer dar uma olhada?',
          },
        ],
      },
    ],
    clientes: [
      {
        nome: 'Pós-viagem',
        quando: 'De 1 a 3 dias depois do retorno do grupo.',
        mensagens: [
          {
            titulo: 'Agradecimento e como foi',
            contexto: 'Primeiro contato depois que o passageiro chega em casa.',
            texto: 'Oi {primeiro}! Que bom ter você com a gente em [destino]. Me conta com sinceridade: o que você mais gostou e o que a gente poderia ter feito melhor? Sua resposta muda a próxima viagem de verdade.',
          },
          {
            titulo: 'Pedido de avaliação e fotos',
            contexto: 'Quando a resposta anterior foi positiva.',
            texto: 'Fico muito feliz, {primeiro}! Posso te pedir um favor? Deixa esse comentário aqui [link] — ajuda demais quem está na dúvida de viajar pela primeira vez. E se tiver fotos boas, manda para mim que eu adoraria compartilhar (com a sua permissão).',
          },
        ],
      },
      {
        nome: 'Indicação',
        quando: 'De 7 a 15 dias depois da viagem, para quem avaliou bem.',
        mensagens: [
          {
            titulo: 'Convite para trazer gente',
            contexto: 'Cliente satisfeito é o melhor canal de venda de excursão.',
            texto: '{primeiro}, tem alguém da sua família ou do seu grupo de amigos que você acha que ia curtir uma viagem dessas? Quem vem por indicação sua [condição real]. É só me passar o contato ou mandar meu número para a pessoa.',
          },
        ],
      },
      {
        nome: 'Próxima viagem',
        quando: 'De 30 a 60 dias depois do retorno.',
        mensagens: [
          {
            titulo: 'O destino que combina com o que ele já fez',
            contexto: 'Use o histórico: quem foi para a serra costuma querer praia depois, e vice-versa.',
            texto: 'Oi {primeiro}! Quem foi com a gente para [destino que ele fez] normalmente se apaixona por [novo destino] — é [o porquê em uma linha]. A próxima saída é [data]. Quer que eu te mande o roteiro?',
          },
          {
            titulo: 'Preferência de quem já viajou',
            contexto: 'Antes de abrir a venda ao público.',
            texto: '{primeiro}, antes de divulgar a viagem de [destino] em [data], estou avisando quem já viajou com a gente. São [n] poltronas e quem já é de casa escolhe primeiro. Quer a sua?',
          },
        ],
      },
      {
        nome: 'Datas que se repetem',
        quando: 'De 60 a 90 dias antes do aniversário da viagem anterior.',
        mensagens: [
          {
            titulo: 'Grupo que fretou no ano passado',
            contexto: 'Fretamento costuma repetir no mesmo período — chegue antes do concorrente.',
            texto: 'Oi {primeiro}! No ano passado vocês fretaram com a gente para [destino] nessa época. Já estão pensando na edição deste ano? Se me disser a data, eu bloqueio o veículo antes de a agenda encher.',
          },
          {
            titulo: 'Aniversário do passageiro',
            contexto: 'Relacionamento puro, sem venda.',
            texto: 'Oi {primeiro}, passando só para te desejar um feliz aniversário! Que o ano te leve para muitos lugares bonitos. Um abraço de toda a equipe da {empresa}.',
          },
        ],
      },
    ],
  },
}
