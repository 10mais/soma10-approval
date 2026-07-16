// Biblioteca de Vendas — perfil CLÍNICA (estética / harmonização facial).
//
// Conteúdo de partida para a recepção atender no WhatsApp. Segue o MÉTODO
// DÉCADA de lib/playbookClinica.ts e as regras de ouro dele:
//   • preço de tratamento e detalhe técnico SÓ na avaliação presencial;
//   • nada de valor, horário, prazo ou resultado inventado — o que for real
//     entra entre [colchetes], preenchido por quem atende;
//   • nenhuma promessa de resultado garantido;
//   • acolhimento antes de venda: uma ideia por mensagem, sempre devolvendo
//     a palavra para o paciente.
//
// Tudo aqui é editável na tela — é ponto de partida, não lei.

import type { BibliotecaSeed } from '@/lib/bibliotecaVendas'

export const SEED_CLINICA: BibliotecaSeed = {
  objecoes: [
    {
      nome: 'Preço e valor',
      respostas: [
        {
          titulo: 'Pede preço na primeira mensagem',
          contexto: 'Primeiro contato, a pessoa abre perguntando quanto custa.',
          texto: 'Oi {nome}, tudo bem? Aqui é {sdr} da {clinica}. Consigo te falar de valores com honestidade só depois de entender o seu caso, porque o plano é montado para cada rosto — te passar um número solto agora seria chute. Me conta rapidinho o que mais te incomoda quando você se olha no espelho?',
        },
        {
          titulo: 'Por que a avaliação é paga',
          contexto: 'A pessoa questiona pagar a consulta de avaliação.',
          texto: '{primeiro}, entendo a pergunta. A avaliação não é uma olhada rápida: é um tempo reservado só para você, com análise do seu rosto e um plano feito na medida. É justamente ela que evita que você gaste com procedimento que não era o seu caso. Quer que eu veja um horário para você?',
        },
        {
          titulo: 'Achou caro sem saber o valor',
          contexto: 'Ela presume que é caro antes de qualquer número ser dito.',
          texto: 'Te entendo, {primeiro} — muita gente chega achando que nem cabe. A verdade é que o plano varia bastante de pessoa para pessoa, e tem caso que é bem mais simples do que parece. Vamos fazer assim: você vem na avaliação, entende o que o seu rosto pede, e aí decide com informação na mão. Topa?',
        },
        {
          titulo: 'Não tenho esse dinheiro agora',
          contexto: 'A objeção é de caixa no momento, não de interesse.',
          texto: 'Obrigado por ser sincera comigo, {primeiro}. Isso não fecha porta nenhuma. Na avaliação a gente monta o plano e você escolhe por onde começar e quando — dá para fazer por etapas. Prefere que eu veja uma agenda ainda para [período] ou você quer que eu te procure mais para frente?',
        },
        {
          titulo: 'Preciso parcelar',
          contexto: 'Ela quer, mas o pagamento à vista trava.',
          texto: '{primeiro}, parcelamento a gente conversa sim — as condições eu te passo certinho na avaliação, junto com o plano, para não te dar informação pela metade. O importante é que dinheiro não seja o motivo de você não entender o seu caso. Posso reservar um horário para você?',
        },
        {
          titulo: 'Limite do cartão não dá',
          contexto: 'Ela já quis fechar e esbarrou no limite.',
          texto: 'Isso acontece bastante, {primeiro}, e tem saída. Temos [formas de pagamento] e dá para combinar o começo do plano de um jeito que caiba no seu limite. Me diz o que dá para você por mês que eu vejo com a equipe o melhor caminho?',
        },
        {
          titulo: 'Quanto custa botox aqui',
          contexto: 'Ela pede tabela de um procedimento específico, já com nome.',
          texto: '{primeiro}, {procedimento} não tem preço de tabela porque depende de quanto o seu rosto precisa e de onde — duas pessoas com a mesma idade saem com planos bem diferentes. Por isso o valor sai na avaliação, junto com a indicação. Me conta: o que te fez pensar nesse procedimento?',
        },
        {
          titulo: 'Vale o investimento',
          contexto: 'Ela está em dúvida se compensa gastar com estética.',
          texto: 'Essa é uma decisão bem pessoal, {primeiro}, e ninguém precisa te empurrar. O que eu escuto muito aqui é gente dizendo que voltou a gostar de aparecer em foto. Se isso faz sentido para você, a avaliação é o lugar de ver se o resultado que você quer é possível — sem compromisso nenhum de fechar.',
        },
        {
          titulo: 'Quero saber a faixa, só uma ideia',
          contexto: 'Ela insiste, pedindo apenas uma faixa aproximada.',
          texto: 'Eu entendo, {primeiro}, e queria muito poder resolver por aqui. Só que faixa vira expectativa, e expectativa errada machuca dos dois lados. O que eu te garanto é que na avaliação você recebe o valor exato do SEU plano, sem surpresa depois. Consigo [dia] ou [dia] para você — qual fica melhor?',
        },
        {
          titulo: 'Preço reancorado no risco',
          contexto: 'Ela compara o custo com opções mais baratas do mercado.',
          texto: '{primeiro}, o rosto é a única coisa que a gente não consegue trocar depois. Aqui o que você paga inclui [formação do profissional], [produtos] e o acompanhamento no pós — coisas que nem sempre estão no valor mais baixo. Quer vir conhecer a estrutura antes de decidir qualquer coisa?',
        },
      ],
    },
    {
      nome: 'Vou pensar / depois eu vejo',
      respostas: [
        {
          titulo: 'Vou pensar logo no começo',
          contexto: 'Ela responde isso antes mesmo de você entender o caso.',
          texto: 'Claro, {primeiro}, pensar é o certo mesmo. Só me deixa te ajudar a pensar com informação: o que exatamente ficou na sua cabeça — o valor, o tempo, ou medo de não dar certo? Me diz o real que eu te falo a verdade sobre isso.',
        },
        {
          titulo: 'Vou pensar depois da avaliação',
          contexto: 'Ela já veio, viu o plano e quer tempo.',
          texto: 'Tudo bem, {primeiro}. Você viu o plano e sabe o que o seu rosto pede — isso já é um ganho. Não vou te apressar. Me diz só uma data para eu te procurar: [data] está bom para você?',
        },
        {
          titulo: 'Sumiu no meio da conversa',
          contexto: 'Ela parou de responder sem dizer não.',
          texto: 'Oi {primeiro}, tudo bem? Fiquei na dúvida se te atrapalhei ou se a mensagem se perdeu no meio do dia. Se ainda fizer sentido, continuo com a agenda aqui para você. Quer que eu veja um horário?',
        },
        {
          titulo: 'Agora não é hora',
          contexto: 'Ela diz que está num momento ruim, sem detalhar.',
          texto: 'Te entendo, {primeiro}. Cada coisa tem seu tempo mesmo. Deixo a porta aberta aqui: quando fizer sentido, é só me chamar que eu já sei do que a gente falou. Quer que eu te procure lá por [período] ou prefere me chamar você?',
        },
        {
          titulo: 'Urgência gentil, sem pressão falsa',
          contexto: 'Ela está quase, mas empurrando com a barriga.',
          texto: '{primeiro}, não vou inventar pressa que não existe. O que eu tenho de real é [quantidade] de horários em [período] e eles costumam fechar. Se você quiser, seguro um no seu nome sem compromisso e você me confirma até [prazo]. Faz sentido?',
        },
        {
          titulo: 'Preciso me organizar antes',
          contexto: 'Ela fala em se organizar, financeiramente ou na rotina.',
          texto: 'Perfeito, {primeiro} — e a avaliação ajuda justamente nisso: você sai sabendo o que precisa, quanto é e em quanto tempo, e aí se organiza com número real em vez de achismo. Quer marcar só a avaliação por enquanto?',
        },
        {
          titulo: 'Vou ver e te falo',
          contexto: 'A resposta vaga clássica, sem data.',
          texto: 'Combinado, {primeiro}. Só para eu não te encher nem te esquecer: me dá uma data para eu voltar aqui? Se [data] estiver bom, eu te chamo nesse dia e pronto.',
        },
        {
          titulo: 'Quer pesquisar mais antes',
          contexto: 'Ela diz que quer olhar outras opções ou ler mais.',
          texto: 'Acho ótimo você pesquisar, {primeiro} — sério. Quem pesquisa chega aqui fazendo pergunta melhor. Se quiser, te mando [material sobre o método] para você comparar com calma e a gente se fala depois. Pode ser?',
        },
        {
          titulo: 'Reabrindo com o motivo dela',
          contexto: 'Ela sumiu, mas já tinha contado a queixa dela.',
          texto: 'Oi {primeiro}! Lembrei da nossa conversa sobre {queixa} — apareceu um caso parecido aqui essa semana e me fez pensar em você. Ainda te incomoda? Se sim, vale a gente retomar.',
        },
        {
          titulo: 'Encerrando com dignidade',
          contexto: 'Já foram várias tentativas sem resposta clara.',
          texto: '{primeiro}, não quero ser inconveniente com você. Vou parar de te chamar por aqui, mas fica registrado: seu histórico está guardado e é só me mandar um oi quando quiser retomar. Foi um prazer falar com você.',
        },
      ],
    },
    {
      nome: 'Medo de dor, agulha ou ficar artificial',
      respostas: [
        {
          titulo: 'Medo de ficar com cara falsa',
          contexto: 'O medo principal é o resultado exagerado, não a dor.',
          texto: 'Esse medo é o mais comum aqui, {primeiro}, e ele é saudável. O trabalho que a gente faz é de deixar você parecendo você, mais descansada — não outra pessoa. Na avaliação a [profissional] te mostra até onde faz sentido ir no seu caso, e você decide junto. Quer ver de perto?',
        },
        {
          titulo: 'Tenho pavor de agulha',
          contexto: 'O bloqueio é a agulha em si.',
          texto: 'Te entendo de verdade, {primeiro} — tem paciente aqui que chega tremendo. A gente trabalha com [recursos de conforto] e no seu ritmo, sem pressa nenhuma. Se quiser, você vem só conversar primeiro, sem fazer nada. Topa?',
        },
        {
          titulo: 'Dói muito',
          contexto: 'Ela pergunta direto sobre a dor do procedimento.',
          texto: 'Cada pessoa sente diferente, {primeiro}, então não vou te prometer que não sente nada. O que eu posso te dizer é que a gente usa [recursos de conforto] e que a maioria descreve como bem tolerável. Na avaliação a [profissional] te explica exatamente como é no seu caso. Quer marcar?',
        },
        {
          titulo: 'Vi resultado ruim na internet',
          contexto: 'Ela viu caso malfeito e ficou assustada.',
          texto: '{primeiro}, eu também vejo esses casos e me dão arrepio. É por isso que aqui a gente insiste tanto na avaliação antes de qualquer coisa: procedimento bom começa com indicação certa. Quer conhecer a estrutura e a [profissional] antes de decidir?',
        },
        {
          titulo: 'Medo de não conseguir desfazer',
          contexto: 'Ela teme algo permanente ou irreversível.',
          texto: 'Pergunta muito boa, {primeiro}. Cada procedimento tem um comportamento diferente ao longo do tempo, e isso muda bastante a decisão — por isso é assunto de avaliação, com a [profissional] olhando o seu rosto. Quer que eu reserve um horário para você tirar essa dúvida direto com ela?',
        },
        {
          titulo: 'Vai perceber que eu fiz',
          contexto: 'O receio é social: que família ou colegas notem.',
          texto: 'Entendo, {primeiro}. O objetivo aqui não é chamar atenção — é as pessoas te acharem bem sem saber o porquê. Isso depende de dose e de indicação, que é exatamente o que se define na avaliação. Vamos conversar pessoalmente?',
        },
        {
          titulo: 'Tenho medo de reação',
          contexto: 'Ela fala em alergia, efeito colateral ou saúde.',
          texto: '{primeiro}, essa preocupação é legítima e a gente leva a sério. Justamente por isso a avaliação começa com o seu histórico de saúde — tem coisa que a gente contraindica mesmo. Me conta: você tem alguma condição ou usa alguma medicação que eu já deixe anotada?',
        },
        {
          titulo: 'É seguro mesmo',
          contexto: 'Ela quer segurança sobre a técnica e o produto.',
          texto: 'Aqui a gente trabalha com [produtos e registro] e com [formação da profissional], {primeiro}. Nenhum procedimento é risco zero e quem te disser isso está mentindo — o que existe é indicação certa e mão treinada. Quer vir conhecer e ver isso de perto antes de qualquer decisão?',
        },
        {
          titulo: 'Prova social para acalmar',
          contexto: 'Ela quer, mas precisa ver que deu certo com alguém.',
          texto: '{primeiro}, tenho aqui o caso de uma paciente com uma queixa bem parecida com a sua: [antes/depois]. Cada rosto responde de um jeito, então não é garantia — mas dá para ver o cuidado do trabalho. Quer marcar sua avaliação para ver o que dá no seu caso?',
        },
        {
          titulo: 'Nunca fiz nada antes',
          contexto: 'É a primeira vez dela em clínica de estética.',
          texto: 'Que bom que você me contou, {primeiro} — a gente atende muita gente na primeira vez. A avaliação existe para isso: você entende tudo, pergunta o que quiser e não sai de lá com nada feito se não estiver segura. Quer começar só por ela?',
        },
      ],
    },
    {
      nome: 'Não tenho tempo',
      respostas: [
        {
          titulo: 'Trabalho o dia inteiro',
          contexto: 'A rotina de trabalho ocupa o horário comercial.',
          texto: 'Te entendo, {primeiro}, a maioria das nossas pacientes trabalha fora. Temos horários em [período alternativo] justamente por isso. Me diz qual é o seu melhor dia e eu vejo o que consigo encaixar para você.',
        },
        {
          titulo: 'Quanto tempo demora',
          contexto: 'Ela quer saber se cabe no intervalo dela.',
          texto: '{primeiro}, a avaliação leva em torno de [tempo] — é uma conversa com calma, não uma consulta corrida. Se você me disser a janela que tem no dia, eu te falo se dá para encaixar direitinho. Qual seria?',
        },
        {
          titulo: 'Preciso de tempo de recuperação',
          contexto: 'O medo é ficar marcada ou parada por dias.',
          texto: 'Isso varia bastante de procedimento para procedimento, {primeiro}, e é assunto que a [profissional] te explica direitinho na avaliação, olhando o seu caso. Se você tem um compromisso importante chegando, me conta que a gente pensa no melhor momento. Tem alguma data em vista?',
        },
        {
          titulo: 'Tempo é prioridade, não relógio',
          contexto: 'Ela adia sempre, mas o interesse é claro.',
          texto: '{primeiro}, olha, tempo a gente nunca tem — a gente escolhe. E você me procurou porque {queixa} te incomoda de verdade. Que tal a gente reservar só [tempo] da sua semana para a avaliação e você decidir o resto depois com calma?',
        },
        {
          titulo: 'Semana cheia, semana que vem',
          contexto: 'Ela empurra para a semana seguinte, sem marcar.',
          texto: 'Perfeito, {primeiro}. Só não quero que a semana que vem vire mês que vem. Deixo reservado [dia] em [horário] no seu nome e, se atrapalhar, você me avisa e eu remarco sem problema. Pode ser?',
        },
        {
          titulo: 'Moro longe',
          contexto: 'A distância até a clínica é o obstáculo.',
          texto: 'Entendo, {primeiro}. Recebemos bastante paciente de fora e a gente costuma organizar a agenda para você resolver o máximo na mesma vinda. De onde você vem? Assim eu já penso no melhor horário para você.',
        },
        {
          titulo: 'Tenho filho pequeno',
          contexto: 'A rotina com criança impede sair de casa.',
          texto: 'Sei bem como é, {primeiro}. Nesses casos a gente costuma buscar [horários] que dão mais folga na rotina. Me diz qual parte do dia é mais tranquila para você que eu tento encaixar nela.',
        },
        {
          titulo: 'Vou estar viajando',
          contexto: 'Ela tem viagem ou compromisso longo marcado.',
          texto: 'Sem problema, {primeiro}. Me diz quando você volta que eu já deixo anotado e te chamo na data — assim você não precisa lembrar de mim no meio da viagem. Quando seria?',
        },
        {
          titulo: 'Remarcou várias vezes',
          contexto: 'Ela já desmarcou mais de uma vez.',
          texto: 'Oi {primeiro}, tudo bem? Sem cobrança nenhuma, viu — a vida acontece. Só me ajuda a te ajudar: existe algum dia da semana que costuma dar certo para você? Se não existir, a gente pausa e eu te chamo mais para frente.',
        },
        {
          titulo: 'Encaixe honesto',
          contexto: 'Ela quer o quanto antes e pergunta se tem vaga hoje.',
          texto: '{primeiro}, deixa eu olhar a agenda de verdade antes de te prometer qualquer coisa. Me dá um minutinho que eu confirmo o que tem em [período] e já te falo. Se abrir encaixe, seguro para você.',
        },
      ],
    },
    {
      nome: 'Preciso falar com meu marido/esposa',
      respostas: [
        {
          titulo: 'Preciso falar em casa',
          contexto: 'Primeira vez que a decisão compartilhada aparece.',
          texto: 'Claro, {primeiro}, faz todo sentido conversar em casa. Só me diz uma coisa: a conversa é sobre o dinheiro ou sobre ele entender por que isso é importante para você? Dependendo, eu te ajudo com a informação certa para essa conversa.',
        },
        {
          titulo: 'Ele acha desnecessário',
          contexto: 'O parceiro é contra a ideia em si.',
          texto: 'Isso acontece bastante, {primeiro}, e não é falta de amor — é geralmente falta de entender o quanto {queixa} te incomoda. Quem sente é você. Se quiser, ele pode vir junto na avaliação e tirar as dúvidas dele direto com a [profissional]. Acha que ajudaria?',
        },
        {
          titulo: 'Convidar o parceiro',
          contexto: 'Ela está aberta, mas quer o outro por perto.',
          texto: '{primeiro}, você pode trazer ele na avaliação sem problema nenhum. Muita gente decide melhor ouvindo junto. Me diz um dia que funcione para os dois que eu vejo aqui.',
        },
        {
          titulo: 'É o dinheiro dele',
          contexto: 'A questão financeira depende do parceiro.',
          texto: 'Entendo, {primeiro}. Nesse caso vale ele saber o número certo, não uma estimativa — e o número certo só sai na avaliação, com o plano na mão. Que tal você vir, ver o plano e levar a informação completa para casa?',
        },
        {
          titulo: 'Ele tem medo do resultado',
          contexto: 'O receio do parceiro é o rosto artificial.',
          texto: 'Muito comum, {primeiro}. E olha, esse medo geralmente cai quando a pessoa vê o trabalho de perto. Se ele vier junto, a [profissional] explica direitinho o que faz e o que não faz sentido no seu caso. Quer que eu marque para os dois?',
        },
        {
          titulo: 'Sem avaliação não tem conversa',
          contexto: 'Ela quer levar informação para casa antes de vir.',
          texto: '{primeiro}, o que eu te mandar por aqui vai ser genérico e a conversa em casa vira discussão de achismo. Com a avaliação feita, você chega em casa com plano, valor e prazo do SEU caso. É bem mais fácil de conversar assim. Vamos marcar?',
        },
        {
          titulo: 'Devolvendo a decisão para ela',
          contexto: 'Ela parece querer, mas se apaga na conversa.',
          texto: 'Posso ser sincera contigo, {primeiro}? Você merece essa conversa também. A avaliação não te compromete com nada — nem a fazer, nem a pagar. É só entender o que é possível. Depois você decide com quem quiser. Que tal?',
        },
        {
          titulo: 'Falou e ele disse não',
          contexto: 'Ela voltou com a negativa do parceiro.',
          texto: 'Obrigado por me retornar, {primeiro} — muita gente só some. Deixa eu perguntar: ele disse não para agora ou não para sempre? Se for para agora, eu te chamo lá em [período] e a gente vê como está.',
        },
        {
          titulo: 'Guardando o lugar dela',
          contexto: 'Ela pediu tempo para conversar em casa.',
          texto: 'Combinado, {primeiro}. Vou deixar [dia] em [horário] reservado no seu nome até [prazo], sem compromisso. Se a conversa em casa for boa, é só me confirmar. Se não for, me avisa que eu libero tranquilo.',
        },
        {
          titulo: 'Filha ou mãe decidindo junto',
          contexto: 'Quem opina não é o parceiro, mas família próxima.',
          texto: 'Entendo, {primeiro}, e é bom ter alguém de confiança junto. Ela pode te acompanhar na avaliação sem problema. Me diz qual dia funcionaria para vocês duas que eu vejo a agenda.',
        },
      ],
    },
    {
      nome: 'Vi mais barato em outro lugar',
      respostas: [
        {
          titulo: 'Achou mais barato ali perto',
          contexto: 'Ela cita outro lugar com preço menor, sem detalhes.',
          texto: '{primeiro}, existe mais barato sim, e eu não vou fingir que não. O que eu te peço é: antes de decidir, pergunta lá quem aplica, qual produto e como é o pós. Rosto não tem desconto que compense correção. Quer vir conhecer a nossa estrutura e comparar de verdade?',
        },
        {
          titulo: 'Comparando o que não é comparável',
          contexto: 'A comparação é preço contra preço, sem contexto.',
          texto: 'Faz sentido comparar, {primeiro}. Só que preço só compara igual com igual — e aqui entra [formação da profissional], [produtos] e o acompanhamento depois. Na avaliação você vê tudo isso e aí a comparação fica justa. Vamos marcar?',
        },
        {
          titulo: 'Promoção relâmpago em outro lugar',
          contexto: 'Ela viu oferta com prazo curto e ficou tentada.',
          texto: '{primeiro}, promoção de procedimento estético é o tipo de pressa que costuma sair cara. Se der certo, ótimo, fico feliz por você de verdade. Se você quiser uma segunda opinião antes, a avaliação está aqui. O que acha?',
        },
        {
          titulo: 'Vocês cobrem o preço',
          contexto: 'Ela pede que a clínica iguale a concorrência.',
          texto: '{primeiro}, eu não trabalho com cobrir preço porque não vendo a mesma coisa. O que eu posso fazer é te mostrar o que está incluso aqui e você decidir se vale para você. Sem drama nenhum se a resposta for não. Quer conhecer?',
        },
        {
          titulo: 'Fez em outro lugar e não gostou',
          contexto: 'Ela já teve experiência ruim com opção mais barata.',
          texto: 'Sinto muito que tenha acontecido, {primeiro}. Caso assim a gente atende com bastante cuidado, porque exige avaliar o que já foi feito antes de qualquer coisa. Me conta o que foi feito e há quanto tempo? Assim eu já anoto para a [profissional].',
        },
        {
          titulo: 'É o mesmo produto',
          contexto: 'Ela argumenta que o produto usado é igual.',
          texto: 'Pode até ser o mesmo, {primeiro}. Só que o resultado não está no frasco, está em quem aplica e no quanto. É a mesma tinta na mão de dois pintores diferentes. Vem conhecer a [profissional] e você tira sua conclusão. Que tal?',
        },
        {
          titulo: 'Fizeram preço sem me ver',
          contexto: 'O outro lugar passou valor pelo WhatsApp sem avaliação.',
          texto: '{primeiro}, isso me diz muita coisa. Passar valor sem olhar o rosto é vender procedimento, não cuidar de pessoa. Aqui a gente faz o contrário: primeiro entende, depois indica. Quer experimentar essa conversa? A avaliação é o lugar dela.',
        },
        {
          titulo: 'Vou tentar lá primeiro',
          contexto: 'Ela decidiu ir na outra clínica antes.',
          texto: 'Tudo bem, {primeiro}, é sua decisão e eu respeito. Vou deixar seu cadastro aqui e, se você quiser conversar antes ou depois, é só me chamar. Torço para dar certo, sério.',
        },
        {
          titulo: 'Qualidade sem falar mal de ninguém',
          contexto: 'Ela quer ouvir por que aqui é diferente.',
          texto: 'Não vou falar do trabalho dos outros, {primeiro} — não é meu estilo. Do nosso eu falo: [estrutura], [formação da profissional] e paciente acompanhada no pós, não abandonada depois da aplicação. Se isso importa para você, vem conhecer.',
        },
        {
          titulo: 'Barato que sai caro',
          contexto: 'Ela está madura na conversa e ainda em cima do muro.',
          texto: '{primeiro}, deixa eu te fazer uma pergunta honesta: se der certo lá, você economizou. Se não der, quanto custa arrumar? A gente atende bastante correção aqui, e correção quase sempre é mais cara que o original. Vale pelo menos ouvir uma segunda opinião na avaliação?',
        },
      ],
    },
  ],

  cadencias: [
    {
      nome: 'Harmonização facial',
      descricao: 'Lead que levantou a mão para o Método DÉCADA ou para harmonização em geral. Do primeiro oi ao horário confirmado, sem falar preço antes da avaliação.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Primeiro oi com nome e motivo',
          contexto: 'Assim que o lead chega — responda em até [tempo de resposta].',
          texto: 'Oi {nome}! Aqui é {sdr} da {clinica}. Vi que você se interessou pela harmonização facial. Antes de qualquer coisa, queria entender o seu caso. Posso te fazer duas perguntinhas rápidas?',
        },
        {
          fase: 'abordagem',
          titulo: 'Quebra-gelo se não responder',
          contexto: 'Algumas horas depois do primeiro oi, sem resposta.',
          texto: 'Oi {primeiro}, deve ter passado no meio da correria do dia. Continuo por aqui quando você puder falar. É rapidinho, prometo.',
        },
        {
          fase: 'qualificacao',
          titulo: 'A queixa antes de tudo',
          contexto: 'Assim que ela responder o primeiro contato.',
          texto: 'Que bom te ver por aqui, {primeiro}! Me conta com suas palavras: o que mais te incomoda quando você se olha no espelho hoje?',
        },
        {
          fase: 'qualificacao',
          titulo: 'Idade e histórico',
          contexto: 'Depois de ela dizer a queixa — nunca antes.',
          texto: 'Entendi, {primeiro}, obrigado por confiar. Mais duas coisinhas para eu anotar na sua ficha: quantos anos você tem e já fez algum procedimento estético antes?',
        },
        {
          fase: 'interesse',
          titulo: 'Apresentar o método sem detalhe técnico',
          contexto: 'Ela já contou a queixa e você entendeu o desejo dela.',
          texto: '{primeiro}, o que a gente faz aqui é o Método DÉCADA: em vez de olhar um detalhe isolado, a gente combina protocolos para o rosto inteiro voltar a parecer mais descansado. O que entra no seu plano depende do seu rosto — por isso a avaliação existe.',
        },
        {
          fase: 'interesse',
          titulo: 'Prova social com caso parecido',
          contexto: 'A queixa dela lembra um caso que você tem registrado.',
          texto: 'Olha só, {primeiro}: essa paciente chegou com uma queixa bem parecida com a sua. [antes/depois]. Cada rosto responde de um jeito, mas dá para ver a linha do trabalho. O que você achou?',
        },
        {
          fase: 'agendamento',
          titulo: 'Convite para a avaliação',
          contexto: 'Ela demonstrou interesse ou reagiu bem à prova social.',
          texto: 'Pelo que você me contou, {primeiro}, o próximo passo é a avaliação presencial — é nela que a [profissional] monta o seu plano, com valor e tudo certinho. Tenho [dia] e [dia] em aberto. Qual fica melhor para você?',
        },
        {
          fase: 'agendamento',
          titulo: 'Segurando o horário',
          contexto: 'Ela escolheu um dia mas não confirmou.',
          texto: 'Combinado, {primeiro}! Vou deixar [dia] às [horário] reservado no seu nome. Me confirma até [prazo] para eu não segurar à toa? Qualquer coisa a gente remarca sem problema.',
        },
        {
          fase: 'fechamento',
          titulo: 'Confirmação com endereço',
          contexto: 'Um dia antes da avaliação confirmada.',
          texto: 'Oi {primeiro}! Passando para confirmar sua avaliação amanhã, [dia] às [horário], aqui na {clinica} — [endereço]. Está de pé para você?',
        },
        {
          fase: 'fechamento',
          titulo: 'Última tentativa sem insistir',
          contexto: 'Vários toques sem resposta — feche o ciclo com respeito.',
          texto: '{primeiro}, não quero ser insistente com você. Se fizer sentido agora, seguro seu horário; se preferir, retomo mais para frente e você não precisa nem responder. Fica do jeito que for melhor para você.',
        },
      ],
    },
    {
      nome: 'Botox / Toxina',
      descricao: 'Lead que já chega pedindo botox pelo nome. Cuidado: quem já sabe o nome do procedimento costuma pular direto para o preço — segure e volte para a queixa.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Recebendo quem já sabe o nome',
          contexto: 'Ela abriu a conversa pedindo botox.',
          texto: 'Oi {nome}! Aqui é {sdr} da {clinica}. Que bom que você me chamou. Antes de eu te falar qualquer coisa sobre {procedimento}, me conta: o que te fez pensar nele agora?',
        },
        {
          fase: 'abordagem',
          titulo: 'Retomando quem não respondeu',
          contexto: 'Silêncio depois do primeiro contato.',
          texto: 'Oi {primeiro}, tudo bem? Não quero te atrapalhar, só não queria te deixar sem resposta. Quando puder, me conta o que te incomoda que eu te ajudo por aqui.',
        },
        {
          fase: 'qualificacao',
          titulo: 'Qual linha te incomoda',
          contexto: 'Ela respondeu e falou em rugas ou expressão.',
          texto: 'Entendi, {primeiro}. Me ajuda a visualizar: é mais a região da testa, do meio das sobrancelhas ou do canto dos olhos que te incomoda? Ou é o conjunto mesmo?',
        },
        {
          fase: 'qualificacao',
          titulo: 'Já fez antes e quando',
          contexto: 'Precisa saber se é primeira vez ou manutenção.',
          texto: '{primeiro}, você já fez {procedimento} alguma vez? Se sim, faz quanto tempo mais ou menos? Isso muda bastante a conversa e eu já deixo anotado para a [profissional].',
        },
        {
          fase: 'interesse',
          titulo: 'Por que não existe preço de tabela',
          contexto: 'Ela pergunta o valor no meio da conversa.',
          texto: '{primeiro}, {procedimento} não tem tabela porque depende de quanto e de onde o seu rosto precisa — duas pessoas da mesma idade saem com planos bem diferentes. O valor exato do SEU caso sai na avaliação, junto com a indicação. Faz sentido para você?',
        },
        {
          fase: 'interesse',
          titulo: 'Expectativa honesta sobre duração',
          contexto: 'Ela pergunta quanto tempo dura o efeito.',
          texto: 'Boa pergunta, {primeiro}. Não dá para cravar um número: depende do seu metabolismo, da região e da dose. Nada aqui é para sempre — é manutenção. Na avaliação a [profissional] te dá a expectativa real para o seu caso.',
        },
        {
          fase: 'agendamento',
          titulo: 'Convite para a avaliação',
          contexto: 'A queixa está clara e ela está engajada.',
          texto: 'Pelo que você me contou, {primeiro}, vale muito você passar por uma avaliação. É rápida, é só uma conversa com o rosto na frente — e você sai sabendo se {procedimento} é mesmo o seu caso. Prefere [dia] ou [dia]?',
        },
        {
          fase: 'agendamento',
          titulo: 'Encaixe para quem tem data em vista',
          contexto: 'Ela mencionou um evento ou uma data importante.',
          texto: '{primeiro}, como você tem [evento] chegando, o ideal é a gente conversar logo — assim a [profissional] te orienta sobre o melhor momento, sem correria. Consigo te encaixar em [dia]. Serve?',
        },
        {
          fase: 'fechamento',
          titulo: 'Confirmação da véspera',
          contexto: 'Um dia antes do horário marcado.',
          texto: 'Oi {primeiro}! Confirmando sua avaliação amanhã, [dia] às [horário], na {clinica} — [endereço]. Posso confirmar?',
        },
        {
          fase: 'fechamento',
          titulo: 'Fechando o ciclo com porta aberta',
          contexto: 'Ela esfriou e não responde há dias.',
          texto: '{primeiro}, vou parar de te chamar para não te incomodar. Fica registrado aqui o que a gente conversou sobre {queixa} — quando quiser retomar, é só me mandar um oi. Um abraço.',
        },
      ],
    },
    {
      nome: 'Preenchimento labial',
      descricao: 'Procedimento com forte carga de expectativa e medo de exagero. A conversa aqui é mais sobre referência visual e naturalidade do que sobre técnica.',
      mensagens: [
        {
          fase: 'abordagem',
          titulo: 'Primeiro contato acolhedor',
          contexto: 'Lead novo interessado em preenchimento labial.',
          texto: 'Oi {nome}! Aqui é {sdr} da {clinica}. Vi seu interesse em preenchimento labial. Me conta uma coisa antes de mais nada: o que você gostaria que fosse diferente na sua boca hoje?',
        },
        {
          fase: 'abordagem',
          titulo: 'Reaproximação leve',
          contexto: 'Sem resposta ao primeiro contato.',
          texto: 'Oi {primeiro}, tudo bem? Só passando para dizer que estou por aqui quando você quiser conversar. Sem pressa nenhuma.',
        },
        {
          fase: 'qualificacao',
          titulo: 'Entendendo a expectativa',
          contexto: 'Ela respondeu e falou do que incomoda.',
          texto: 'Entendi, {primeiro}. E me diz: você imagina algo mais discreto, para hidratar e dar contorno, ou está pensando em mudar bastante o volume? Isso me ajuda a te orientar melhor.',
        },
        {
          fase: 'qualificacao',
          titulo: 'Histórico na região',
          contexto: 'Antes de qualquer indicação — é informação clínica.',
          texto: '{primeiro}, você já fez algum preenchimento nos lábios antes? E costuma ter herpes labial? São duas coisas que mudam a conduta e eu já deixo anotado para a [profissional].',
        },
        {
          fase: 'interesse',
          titulo: 'Naturalidade como bandeira',
          contexto: 'Ela demonstrou medo de ficar exagerada.',
          texto: '{primeiro}, o trabalho aqui é de respeitar a sua boca, não de trocar por outra. A ideia é você continuar sendo você, com o contorno que te agrada. Até onde faz sentido ir no seu caso é a [profissional] que te mostra, olhando o seu rosto.',
        },
        {
          fase: 'interesse',
          titulo: 'Referência visual dela',
          contexto: 'Ela mandou foto de referência ou pediu exemplos.',
          texto: 'Adorei você me mandar referência, {primeiro} — isso ajuda muito. Só que boca não é catálogo: o que dá certo depende da sua proporção. Leva essa foto na avaliação que a [profissional] te fala com sinceridade o que é possível no seu caso.',
        },
        {
          fase: 'agendamento',
          titulo: 'Convite para a avaliação',
          contexto: 'A expectativa está clara e ela está engajada.',
          texto: '{primeiro}, o próximo passo é a avaliação. É lá que a [profissional] olha a sua boca, entende sua referência e monta o plano — com valor certinho, sem surpresa. Tenho [dia] e [dia]. Qual você prefere?',
        },
        {
          fase: 'agendamento',
          titulo: 'Reserva com prazo',
          contexto: 'Ela topou mas ainda não confirmou o dia.',
          texto: 'Show, {primeiro}! Deixo [dia] às [horário] no seu nome até [prazo]. Se precisar mudar, é só me falar que eu remarco tranquilo. Combinado?',
        },
        {
          fase: 'fechamento',
          titulo: 'Confirmação da véspera',
          contexto: 'Um dia antes do horário marcado.',
          texto: 'Oi {primeiro}! Confirmando sua avaliação amanhã, [dia] às [horário], aqui na {clinica} — [endereço]. Está tudo certo para você?',
        },
        {
          fase: 'fechamento',
          titulo: 'Encerrando sem cobrança',
          contexto: 'Ela sumiu depois de vários toques.',
          texto: '{primeiro}, não vou mais te chamar para não ser chata. Se em algum momento você quiser retomar a conversa sobre {queixa}, é só me mandar uma mensagem que eu já sei do seu caso. Fica bem!',
        },
      ],
    },
  ],

  roteiros: [
    {
      nome: 'Lead novo (primeiro contato)',
      descricao: 'Método DÉCADA, fases 1 a 4: acolher, qualificar, apresentar o método e convidar para a avaliação. Uma pergunta por mensagem — WhatsApp não é formulário.',
      perguntas: [
        {
          pergunta: 'Oi! Aqui é {sdr} da {clinica}. Com quem eu falo?',
          contexto: 'Nome próprio muda o tom da conversa inteira e evita o "oi, tudo bem" genérico.',
          seSim: 'Anote o nome na ficha e passe a chamar de {primeiro} da segunda mensagem em diante.',
          seNao: 'Se ela ignorar e já pedir preço, acolha primeiro e devolva a pergunta uma vez só.',
          parada: 'Se a pessoa só quiser preço e recusar qualquer conversa, não insista: explique em uma mensagem por que o valor sai na avaliação e ofereça o agendamento.',
        },
        {
          pergunta: 'O que mais te incomoda quando você se olha no espelho hoje?',
          contexto: 'É a pergunta central do método. Sem a queixa na mão, tudo o que vier depois é chute.',
          seSim: 'Registre a queixa com as palavras DELA em {queixa} — é o que você vai usar no reaquecimento depois.',
          seNao: 'Se ela travar, ofereça caminhos: é mais a pele, a expressão, o contorno do rosto?',
          parada: 'Se a queixa for algo que exige conduta médica (lesão, dor, alteração recente), pare a venda e encaminhe para avaliação clínica.',
        },
        {
          pergunta: 'Isso te incomoda há quanto tempo?',
          contexto: 'Tempo de incômodo mede o quanto ela quer resolver — quem convive há anos costuma decidir mais rápido.',
          seSim: 'Se for antigo, reconheça: "então você já convive com isso há um tempo" antes de seguir.',
          seNao: 'Se for recente, investigue o que mudou — pode ter um gatilho (foto, comentário, evento).',
        },
        {
          pergunta: 'Posso te perguntar sua idade?',
          contexto: 'Idade orienta a indicação e é dado obrigatório na ficha.',
          seSim: 'Anote e siga sem comentar a idade dela.',
          seNao: 'Se ela não quiser dizer, não insista: a [profissional] pergunta na avaliação.',
          parada: 'Menor de 18 anos: pare o agendamento. Explique que o atendimento exige presença e autorização dos responsáveis e peça o contato de um deles.',
        },
        {
          pergunta: 'Você já fez algum procedimento estético antes?',
          contexto: 'Muda a conduta e a expectativa. Quem já fez compara; quem nunca fez precisa de mais acolhimento.',
          seSim: 'Pergunte o quê, onde e há quanto tempo, e anote para a [profissional].',
          seNao: 'Tranquilize: diga que a avaliação existe justamente para a primeira vez, sem compromisso de fazer nada.',
        },
        {
          pergunta: 'Você tem alguma condição de saúde ou usa alguma medicação contínua?',
          contexto: 'Segurança em primeiro lugar. Tem coisa que a clínica contraindica e é melhor saber agora.',
          seSim: 'Anote exatamente o que ela disse e avise que a [profissional] confirma tudo na avaliação.',
          seNao: 'Siga, mas mantenha a pergunta registrada como respondida na ficha.',
          parada: 'Gestante, lactante, doença autoimune ou qualquer condição relatada: não opine e não indique nada. Encaminhe para avaliação e sinalize o caso para a [profissional] antes.',
        },
        {
          pergunta: 'Como você gostaria de se sentir ao se olhar no espelho daqui a alguns meses?',
          contexto: 'Traz o desejo à tona — é o combustível da decisão e o que faz o preço virar investimento.',
          seSim: 'Repita o desejo dela com as palavras dela antes de apresentar o método. Ela precisa se sentir ouvida.',
          seNao: 'Se ela responder de forma vaga, use o oposto: o que você não quer de jeito nenhum?',
          parada: 'Expectativa irreal (querer o rosto de outra pessoa, resultado permanente, transformação total sem cirurgia): não alimente. Diga com carinho que ninguém promete isso com honestidade e que a [profissional] vai te falar o que é possível.',
        },
        {
          pergunta: 'Posso te explicar em duas linhas como funciona o nosso método?',
          contexto: 'Fase 3 do método: valor antes de agenda. Sem detalhe técnico, sem nome de produto.',
          seSim: 'Explique o DÉCADA como combinação de protocolos para o rosto inteiro, e pare por aí.',
          seNao: 'Se ela estiver com pressa, pule direto para o convite da avaliação.',
        },
        {
          pergunta: 'Que tal a gente marcar sua avaliação? Prefere [dia] ou [dia]?',
          contexto: 'Fase 4. Duas opções fecham mais que uma pergunta aberta — mas ofereça só horário que existe de verdade.',
          seSim: 'Confirme dia, horário e endereço na mesma mensagem e registre na agenda.',
          seNao: 'Trate a objeção específica (aba Objeções) e reconduza ao agendamento uma vez. Depois, marque um retorno com data.',
          parada: 'Se ela disser não duas vezes, pare de oferecer horário. Peça uma data para retomar e encerre com a porta aberta.',
        },
        {
          pergunta: 'Confirmando: [dia] às [horário], aqui na {clinica}. Está certo?',
          contexto: 'Fase 6. Confirmação explícita reduz falta e deixa o combinado por escrito.',
          seSim: 'Mande o endereço, o que levar e reforce que o horário é exclusivo dela.',
          seNao: 'Se ela hesitar na confirmação, é sinal de dúvida escondida. Pergunte o que ficou.',
        },
      ],
    },
    {
      nome: 'Paciente antigo voltando',
      descricao: 'Ela já confiou, já pagou e já conhece o resultado. Comece pelo que ela fez — o procedimento e a data estão na ficha. Nada de "oi, tudo bem" genérico.',
      perguntas: [
        {
          pergunta: 'Oi {primeiro}! Vi aqui que você fez {procedimento} com a gente. Como você está se sentindo com o resultado hoje?',
          contexto: 'Abre pelo histórico, não pela venda. Mostra que ela é lembrada e não é uma lista.',
          seSim: 'Se ela estiver satisfeita, use isso: é a deixa natural para falar de manutenção.',
          seNao: 'Se ela estiver insatisfeita, pare a venda imediatamente. Ouça tudo e encaminhe para reavaliação sem cobrar nada.',
          parada: 'Insatisfação ou queixa sobre um resultado nosso: não venda nada. Registre, sinalize para a [profissional] e ofereça retorno.',
        },
        {
          pergunta: 'Faz mais ou menos [tempo] desde a última vez, certo?',
          contexto: 'Confirmar a data faz ela mesma perceber o tempo que passou — sem você cobrar.',
          seSim: 'Ancore a manutenção nesse tempo, sem prometer prazo de duração de efeito.',
          seNao: 'Se a ficha estiver errada, corrija na hora e agradeça a correção.',
        },
        {
          pergunta: 'Aquilo que te incomodava na época ({queixa}) voltou a aparecer?',
          contexto: 'A queixa antiga é o gancho mais forte que existe — ela já reconheceu o problema uma vez.',
          seSim: 'Reconheça e proponha a reavaliação para ver o que faz sentido agora.',
          seNao: 'Ótimo sinal. Pergunte se surgiu algo novo que ela gostaria de olhar.',
        },
        {
          pergunta: 'Tem alguma coisa nova te incomodando que você gostaria de olhar?',
          contexto: 'Abre espaço para um plano diferente do anterior, sem empurrar procedimento.',
          seSim: 'Anote a nova queixa em {queixa} e trate como caso novo — inclusive nas perguntas de saúde.',
          seNao: 'Não force. Ofereça manutenção do que já foi feito ou apenas deixe a porta aberta.',
        },
        {
          pergunta: 'Mudou alguma coisa na sua saúde ou nas medicações desde a última vez?',
          contexto: 'Ficha antiga não é ficha atual. É a pergunta que protege a paciente e a clínica.',
          seSim: 'Anote tudo e sinalize para a [profissional] antes de qualquer agendamento.',
          seNao: 'Registre que a informação foi confirmada nesta data.',
          parada: 'Gestação, amamentação ou condição nova relatada: não indique nada por mensagem. Encaminhe para avaliação.',
        },
        {
          pergunta: 'Você fez algum procedimento em outro lugar nesse meio tempo?',
          contexto: 'Muda a conduta completamente — a [profissional] precisa saber o que já tem no rosto.',
          seSim: 'Pergunte o quê, onde e quando, sem julgamento nenhum na resposta.',
          seNao: 'Siga normalmente.',
          parada: 'Se ela relatar procedimento recente feito fora e com queixa, é caso clínico: encaminhe para avaliação antes de qualquer proposta.',
        },
        {
          pergunta: 'Quer que eu veja uma agenda para a sua reavaliação?',
          contexto: 'Convite direto. Paciente antiga não precisa de rodeio, ela já conhece o caminho.',
          seSim: 'Ofereça duas opções reais de horário e confirme na mesma mensagem.',
          seNao: 'Pergunte o que a segura: tempo, dinheiro ou dúvida sobre o resultado. Trate a objeção real.',
        },
        {
          pergunta: 'Qual parte do dia costuma ser melhor para você hoje?',
          contexto: 'A rotina dela pode ter mudado desde a última vez. Perguntar evita a remarcação.',
          seSim: 'Encaixe dentro da janela que ela deu e confirme.',
          seNao: 'Se nada servir, combine um retorno com data em vez de ficar oferecendo horário.',
        },
        {
          pergunta: 'Posso te chamar de novo lá por [período] se agora não for a hora?',
          contexto: 'Fecha o ciclo com data em vez de deixar o lead morrer no silêncio.',
          seSim: 'Registre a data do retorno na ficha e cumpra — quem promete e some queima a base.',
          seNao: 'Respeite. Anote a preferência dela de não ser contatada e encerre com carinho.',
          parada: 'Se ela pedir para não receber mais mensagens, pare na hora e registre. Insistir depois disso queima a clínica.',
        },
        {
          pergunta: 'Confirmando: [dia] às [horário], aqui na {clinica}. Combinado?',
          contexto: 'Mesmo quem já veio precisa da confirmação por escrito — reduz falta.',
          seSim: 'Reforce o endereço e agradeça a confiança de voltar.',
          seNao: 'Se hesitar, pergunte o que ficou no ar antes de liberar o horário.',
        },
      ],
    },
  ],

  reaquecimento: {
    leads: [
      {
        nome: 'Pediu preço e sumiu',
        quando: 'Perguntou quanto custa, ouviu que o valor sai na avaliação e parou de responder.',
        mensagens: [
          {
            titulo: 'Sem cobrança, com honestidade',
            contexto: 'Alguns dias depois do silêncio — primeiro toque da retomada.',
            texto: 'Oi {primeiro}, tudo bem? Aqui é {sdr} da {clinica}. Sei que você queria o valor e eu não consegui te dar um número pelo WhatsApp — não é enrolação, é que o plano muda muito de rosto para rosto. Se quiser, me conta o que te incomoda que eu te ajudo a entender se vale a pena para você.',
          },
          {
            titulo: 'O que a avaliação resolve',
            contexto: 'Alguns dias depois, se ela não respondeu ao primeiro toque.',
            texto: '{primeiro}, uma coisa que talvez te ajude: na avaliação você sai com o plano, o valor certinho e as condições de pagamento — tudo do SEU caso, sem surpresa depois. É só uma conversa, você não fecha nada ali. Quer que eu veja um horário?',
          },
          {
            titulo: 'Prova social e convite',
            contexto: 'Se ela ainda estiver em silêncio e você tiver um caso parecido registrado.',
            texto: 'Oi {primeiro}! Lembrei de você: essa paciente chegou com uma queixa bem parecida com a que você me contou. [antes/depois]. Cada rosto responde de um jeito, mas dá para ver o cuidado do trabalho. Vale marcar sua avaliação?',
          },
          {
            titulo: 'Fechando o ciclo',
            contexto: 'Último toque. Depois disso, pare e registre na ficha.',
            texto: '{primeiro}, vou parar de te chamar para não te incomodar. Se um dia quiser retomar, é só me mandar um oi que eu já sei do seu caso. Um abraço da {clinica}.',
          },
        ],
      },
      {
        nome: 'Agendou e não compareceu',
        quando: 'Tinha avaliação marcada e não apareceu, sem avisar.',
        mensagens: [
          {
            titulo: 'Preocupação antes de cobrança',
            contexto: 'No mesmo dia da falta ou no dia seguinte. Nunca com tom de cobrança.',
            texto: 'Oi {primeiro}, tudo bem? Você tinha avaliação com a gente [dia] e a gente não te viu — fiquei na dúvida se aconteceu alguma coisa. Está tudo certo por aí?',
          },
          {
            titulo: 'Remarcar sem constrangimento',
            contexto: 'Depois que ela responder, ou dois dias depois se não responder.',
            texto: 'De qualquer forma, {primeiro}, sem problema nenhum — a vida acontece mesmo. Se você quiser, eu remarco para outro dia. Tenho [dia] e [dia] em aberto. Algum deles serve?',
          },
          {
            titulo: 'Descobrindo o motivo real',
            contexto: 'Se ela some de novo depois da tentativa de remarcar.',
            texto: '{primeiro}, me ajuda com uma coisa? Se foi o horário, eu adapto. Se foi outra coisa — dinheiro, insegurança, mudou de ideia — pode me falar sem cerimônia que eu prefiro saber a verdade a ficar te chamando à toa.',
          },
          {
            titulo: 'Porta aberta',
            contexto: 'Último toque desta sequência.',
            texto: 'Tudo bem, {primeiro}. Deixo seu cadastro guardado aqui e paro por aqui. Quando fizer sentido, é só me chamar que eu te encaixo. Fica bem!',
          },
        ],
      },
      {
        nome: 'Base fria de 1 ano',
        quando: 'Contato que entrou há mais de um ano, nunca veio e não fala com a clínica desde então.',
        mensagens: [
          {
            titulo: 'Reabertura honesta',
            contexto: 'Primeiro toque. A honestidade sobre o tempo é o que faz essa mensagem funcionar.',
            texto: 'Oi {primeiro}! Aqui é {sdr} da {clinica}. Faz um tempão que a gente não se fala — você chegou a falar com a gente lá em [período] e acabamos nos perdendo. Estou colocando a agenda em dia: você ainda gostaria de receber novidades nossas por aqui?',
          },
          {
            titulo: 'O que mudou por aqui',
            contexto: 'Se ela responder que sim, ou alguns dias depois se ficar em silêncio.',
            texto: 'Que bom, {primeiro}! Mudou bastante coisa desde então: [novidade da clínica]. E de você, mudou algo? Aquilo que te incomodava na época ainda te incomoda hoje?',
          },
          {
            titulo: 'Convite leve',
            contexto: 'Ela respondeu e a queixa ainda existe.',
            texto: 'Faz sentido, {primeiro}. Se você quiser, a gente marca uma avaliação para você entender o que é possível hoje — sem compromisso nenhum de fazer nada. Quer que eu olhe a agenda?',
          },
          {
            titulo: 'Respeitando o silêncio',
            contexto: 'Último toque. Depois deste, marque o contato como frio e pare.',
            texto: '{primeiro}, como não tive retorno, vou parar de te enviar mensagens por aqui — não quero ocupar seu espaço à toa. Se um dia quiser conversar, a {clinica} está de portas abertas para você. Um abraço.',
          },
        ],
      },
    ],
    clientes: [
      {
        nome: 'Procedimento vencendo (manutenção)',
        quando: 'O efeito do último procedimento está perto de acabar, pela data que está na ficha.',
        mensagens: [
          {
            titulo: 'Hora da manutenção',
            contexto: 'Primeiro toque. Parte da data real da ficha, nunca de um "oi, tudo bem".',
            texto: 'Oi {primeiro}, tudo bem? Aqui é {sdr} da {clinica}. Faz cerca de [tempo] que você fez {procedimento} com a gente. Costuma ser por volta desta época que a manutenção rende mais, porque o efeito ainda não foi embora de todo. Como você está vendo o resultado hoje?',
          },
          {
            titulo: 'Convite para a reavaliação',
            contexto: 'Ela respondeu que já está notando o efeito diminuir.',
            texto: 'É bem isso mesmo, {primeiro}. Vamos fazer assim: marco uma reavaliação para a [profissional] olhar o seu rosto e te dizer o que faz sentido agora — pode ser que precise menos do que da primeira vez. Prefere [dia] ou [dia]?',
          },
          {
            titulo: 'Lembrete gentil',
            contexto: 'Alguns dias sem resposta. Último toque desta sequência.',
            texto: '{primeiro}, sem pressa nenhuma, viu — só não queria que você perdesse o melhor momento sem saber. Quando quiser, é só me chamar que eu olho a agenda para você.',
          },
        ],
      },
      {
        nome: 'Não volta há 6+ meses',
        quando: 'Paciente que veio pelo menos uma vez e não aparece há seis meses ou mais.',
        mensagens: [
          {
            titulo: 'Retomada com memória',
            contexto: 'Primeiro toque. Cite o procedimento pelo nome — é isso que separa de spam.',
            texto: 'Oi {primeiro}! Aqui é {sdr} da {clinica}. Estava revendo os atendimentos e lembrei de você — na época a gente cuidou de {procedimento}. Como você está se sentindo com o resultado hoje?',
          },
          {
            titulo: 'A queixa antiga',
            contexto: 'Ela respondeu, mas não pediu nada.',
            texto: 'Que bom saber, {primeiro}. E aquilo que te incomodava na época ({queixa}) — voltou a te incomodar ou está tranquilo? Pergunto porque, se voltou, vale uma reavaliação para ver o que faz sentido agora.',
          },
          {
            titulo: 'Convite direto',
            contexto: 'Ela sinalizou que algo voltou a incomodar.',
            texto: 'Combinado, {primeiro}. Consigo te encaixar em [dia] ou [dia] para a reavaliação. Qual fica melhor para você?',
          },
          {
            titulo: 'Porta aberta',
            contexto: 'Sem resposta. Último toque — registre e pare.',
            texto: '{primeiro}, vou parar por aqui para não te encher. Seu histórico está todo guardado com a gente, então é só mandar um oi quando quiser voltar. Foi muito bom te atender!',
          },
        ],
      },
      {
        nome: 'Pesquisa de satisfação que reabre a conversa',
        quando: 'Alguns dias depois do último procedimento — o pós que vira conversa nova.',
        mensagens: [
          {
            titulo: 'Como você está',
            contexto: 'Primeiro toque, [dias] depois do procedimento. É cuidado, não venda.',
            texto: 'Oi {primeiro}! Aqui é {sdr} da {clinica}. Passando para saber como você está depois do seu {procedimento}. Está tudo tranquilo por aí?',
          },
          {
            titulo: 'A nota e o porquê',
            contexto: 'Ela respondeu que está bem.',
            texto: 'Fico feliz de saber, {primeiro}! Posso te pedir um favor rápido? De 0 a 10, quanto você indicaria a {clinica} para uma amiga? E, se puder, me conta o motivo da nota — é assim que a gente melhora de verdade.',
          },
          {
            titulo: 'Nota alta vira convite',
            contexto: 'Ela deu nota alta. É aqui que a pesquisa reabre a conversa — sem forçar.',
            texto: 'Nossa, {primeiro}, obrigado! Isso faz o nosso dia. Se você conhece alguém que estaria precisando de um cuidado desses, pode me mandar por aqui que eu atendo com todo o carinho. E qualquer dúvida sobre o seu pós, é só chamar.',
          },
          {
            titulo: 'Nota baixa vira escuta',
            contexto: 'Ela deu nota baixa ou relatou algo. Aqui não se vende nada, se escuta.',
            texto: '{primeiro}, obrigado pela sinceridade — é assim que a gente aprende. Quero entender direito o que aconteceu. Me conta tudo, sem filtro? Vou levar isso para a [profissional] e a gente te dá um retorno.',
          },
        ],
      },
    ],
  },
}
