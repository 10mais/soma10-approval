// IDIOMA DO SISTEMA — dono, 20/09/2026: "construa/adapte o Soma10 para alteração de idioma:
// PORTUGUÊS-BR, INGLÊS, ESPANHOL. Todos os nomes que estão em inglês na versão atual altere
// para português e consolide o idioma."
//
// Duas coisas ao mesmo tempo, e esta lib resolve as duas:
//
// 1. O PORTUGUÊS VIRA UM SÓ. O sistema nasceu com nome de tela em inglês (Planner, Studio,
//    Personal list, Inbox, Brand Board, Analytics) misturado com português. Aqui está o nome
//    OFICIAL de cada área em pt-BR, num lugar só — a lição de lib/formatoPost: rótulo repetido
//    em cada tela diverge.
// 2. A MESMA CHAVE serve os outros idiomas. `t('nav.planner', 'en')` devolve "Post scheduler".
//
// A CHAVE NUNCA MUDA. `planner`, `studio`, `playbook` continuam sendo o que está gravado no
// Redis, na URL e no `sessionStorage` — trocar isso quebraria o que já existe. O que muda é
// só o que a pessoa lê.
//
// Decisões do dono (20/09): Playbook → "Plano de entregas"; CRM continua CRM; Briefing vira
// "Pauta"; Analytics vira "Desempenho"; Feed/Story/Reel/Carrossel ficam (são os nomes do
// próprio Instagram, ver lib/formatoPost).

export type Idioma = 'pt' | 'en' | 'es'
export const IDIOMA_PADRAO: Idioma = 'pt'

export const IDIOMAS: { chave: Idioma; label: string; pronto: boolean }[] = [
  { chave: 'pt', label: 'Português (Brasil)', pronto: true },
  { chave: 'en', label: 'English', pronto: true },
  // Espanhol entra quando o dicionário estiver completo; até lá não aparece na escolha
  // (idioma pela metade é pior do que idioma nenhum).
  { chave: 'es', label: 'Español', pronto: false },
]
export const idiomasDisponiveis = () => IDIOMAS.filter(i => i.pronto)

type Entrada = { pt: string; en: string; es?: string }

// NOMES DAS ÁREAS (menu, título da tela, seletor de permissões). A chave é a mesma do `aba`/
// `ABAS_PERM`.
export const TEXTOS: Record<string, Entrada> = {
  // ---- pessoal
  'nav.home': { pt: 'Painel', en: 'Dashboard', es: 'Panel' },
  'nav.meu-card': { pt: 'Meu perfil', en: 'My profile', es: 'Mi perfil' },
  'nav.equipe': { pt: 'Equipe', en: 'Team', es: 'Equipo' },
  'nav.lista-pessoal': { pt: 'Anotações', en: 'Notes', es: 'Notas' },
  'nav.minha-conta': { pt: 'Minha conta', en: 'My account', es: 'Mi cuenta' },
  // ---- produção
  'nav.tarefas': { pt: 'Tarefas', en: 'Tasks', es: 'Tareas' },
  'nav.studio': { pt: 'Estúdio', en: 'Content studio', es: 'Estudio' },
  'nav.esteira': { pt: 'Esteira de produção', en: 'Production line', es: 'Línea de producción' },
  'nav.agenda': { pt: 'Agenda', en: 'Calendar', es: 'Agenda' },
  'nav.planner': { pt: 'Programador de postagens', en: 'Post scheduler', es: 'Programador de publicaciones' },
  'nav.calendario': { pt: 'Calendário', en: 'Calendar', es: 'Calendario' },
  'nav.aprovacoes': { pt: 'Aprovações', en: 'Approvals', es: 'Aprobaciones' },
  'nav.carga': { pt: 'Carga da equipe', en: 'Team workload', es: 'Carga del equipo' },
  'nav.agentes': { pt: 'Agentes de IA', en: 'AI agents', es: 'Agentes de IA' },
  'nav.documentos': { pt: 'Documentos', en: 'Documents', es: 'Documentos' },
  'nav.mapas': { pt: 'Mapas mentais', en: 'Mind maps', es: 'Mapas mentales' },
  'nav.novo-post': { pt: 'Nova postagem', en: 'New post', es: 'Nueva publicación' },
  // ---- estratégia
  'nav.playbook': { pt: 'Plano de entregas', en: 'Delivery plan', es: 'Plan de entregas' },
  'nav.campanhas': { pt: 'Campanhas', en: 'Campaigns', es: 'Campañas' },
  'nav.modelos': { pt: 'Modelos', en: 'Templates', es: 'Plantillas' },
  'nav.automacoes': { pt: 'Automações', en: 'Automations', es: 'Automatizaciones' },
  'nav.marca': { pt: 'Marca', en: 'Brand', es: 'Marca' },
  'nav.listening': { pt: 'Escuta social', en: 'Social listening', es: 'Escucha social' },
  'nav.analytics': { pt: 'Desempenho', en: 'Performance', es: 'Rendimiento' },
  'nav.metricas': { pt: 'Métricas', en: 'Campaign metrics', es: 'Métricas' },
  'nav.relatorio': { pt: 'Relatório da semana', en: 'Weekly report', es: 'Informe semanal' },
  'nav.entregas': { pt: 'Entregas', en: 'Deliverables', es: 'Entregas' },
  'nav.onboarding': { pt: 'Entrada do cliente', en: 'Client onboarding', es: 'Ingreso del cliente' },
  // ---- vendas
  'nav.crm': { pt: 'CRM', en: 'CRM', es: 'CRM' },
  'nav.metas': { pt: 'Metas', en: 'Goals', es: 'Metas' },
  'nav.conversao': { pt: 'Conversão e retenção', en: 'Conversion & retention', es: 'Conversión y retención' },
  'nav.vendas': { pt: 'Vendas', en: 'Sales', es: 'Ventas' },
  'nav.produtos': { pt: 'Produtos e estoque', en: 'Products & stock', es: 'Productos e inventario' },
  // ---- comunicação
  'nav.inbox': { pt: 'Caixa de entrada', en: 'Inbox', es: 'Bandeja de entrada' },
  'nav.mensagens': { pt: 'Chat interno', en: 'Team chat', es: 'Chat interno' },
  'nav.solicitacoes': { pt: 'Solicitações do cliente', en: 'Client requests', es: 'Solicitudes del cliente' },
  // ---- gestão
  'nav.clientes': { pt: 'Clientes', en: 'Clients', es: 'Clientes' },
  'nav.clientes-todos': { pt: 'Todos os clientes', en: 'All clients', es: 'Todos los clientes' },
  'nav.usuarios': { pt: 'Usuários', en: 'Users', es: 'Usuarios' },
  'nav.rentabilidade': { pt: 'Financeiro', en: 'Finance', es: 'Finanzas' },
  'nav.config': { pt: 'Configurações', en: 'Settings', es: 'Configuración' },
  'nav.biblioteca': { pt: 'Biblioteca', en: 'Library', es: 'Biblioteca' },
  'nav.recrutamento': { pt: 'Recrutamento', en: 'Recruiting', es: 'Reclutamiento' },
  'nav.candidaturas': { pt: 'Candidaturas', en: 'Applications', es: 'Candidaturas' },
  'nav.reunioes': { pt: 'Reuniões', en: 'Meetings', es: 'Reuniones' },
  // ---- operação (turismo / clínica / assessoria / varejo)
  'nav.viagens': { pt: 'Viagens', en: 'Trips', es: 'Viajes' },
  'nav.calendario-viagens': { pt: 'Calendário de viagens', en: 'Trip calendar', es: 'Calendario de viajes' },
  'nav.reservas': { pt: 'Reservas', en: 'Bookings', es: 'Reservas' },
  'nav.frota': { pt: 'Frota', en: 'Fleet', es: 'Flota' },
  'nav.procedimentos': { pt: 'Procedimentos e métodos', en: 'Procedures & methods', es: 'Procedimientos y métodos' },
  'nav.processos': { pt: 'Processos', en: 'Cases', es: 'Procesos' },
  'nav.recebiveis': { pt: 'Recebíveis', en: 'Receivables', es: 'Cuentas por cobrar' },

  // ---- Painel (Home)
  'home.ver-como': { pt: 'Ver como', en: 'View as', es: 'Ver como' },
  'home.voce': { pt: '(você)', en: '(you)', es: '(usted)' },
  'home.tentar-de-novo': { pt: 'tentar de novo', en: 'try again', es: 'intentar de nuevo' },
  'home.regra-de': { pt: 'Regra de', en: 'Rule for', es: 'Regla de' },
  'home.hoje': { pt: 'Hoje', en: 'Today', es: 'Hoy' },
  'home.agenda-nao-conectada': { pt: 'Google Agenda ainda não conectada — só reuniões e publicações', en: 'Google Calendar not connected yet — meetings and posts only', es: 'Google Calendar aún no conectado — solo reuniones y publicaciones' },
  'home.abrir-programador': { pt: 'Abrir o Programador', en: 'Open the scheduler', es: 'Abrir el programador' },
  'home.nada-hoje': { pt: 'Nada programado para hoje.', en: 'Nothing scheduled for today.', es: 'Nada programado para hoy.' },
  'home.leg-publicacao': { pt: 'Publicação', en: 'Post', es: 'Publicación' },
  'home.leg-reuniao': { pt: 'Reunião', en: 'Meeting', es: 'Reunión' },
  'home.leg-agenda': { pt: 'Agenda Google', en: 'Google Calendar', es: 'Google Calendar' },
  'home.leg-passou': { pt: 'Já passou', en: 'Already past', es: 'Ya pasó' },
  'home.clientes-dica': { pt: 'quem espera há mais tempo vem primeiro', en: 'whoever has waited longest comes first', es: 'quien espera hace más tiempo viene primero' },
  'home.todos': { pt: 'Todos', en: 'All', es: 'Todos' },
  'home.sem-clientes': { pt: 'Nenhum cliente ativo.', en: 'No active clients.', es: 'Ningún cliente activo.' },
  'home.fase-entrada': { pt: 'Entrada', en: 'Onboarding', es: 'Ingreso' },
  'home.nada-pendente': { pt: 'Nada pendente.', en: 'Nothing pending.', es: 'Nada pendiente.' },
  'home.com-cliente': { pt: 'Com o cliente', en: 'With the client', es: 'Con el cliente' },
  'home.com-equipe': { pt: 'Com a equipe', en: 'With the team', es: 'Con el equipo' },
  'home.em-dia': { pt: 'Em dia', en: 'Up to date', es: 'Al día' },
  'home.sua-fila': { pt: 'Sua fila', en: 'Your queue', es: 'Su fila' },
  'home.fila-de': { pt: 'Fila de', en: 'Queue of', es: 'Fila de' },
  'home.sem-tarefas': { pt: 'Nenhuma tarefa aberta.', en: 'No open tasks.', es: 'Ninguna tarea abierta.' },
  'home.chegou': { pt: 'Chegou do cliente', en: 'Came from the client', es: 'Llegó del cliente' },
  'home.ultimas-24h': { pt: 'últimas 24h', en: 'last 24h', es: 'últimas 24h' },
  'home.sem-chegou': { pt: 'Nada nas últimas 24 horas.', en: 'Nothing in the last 24 hours.', es: 'Nada en las últimas 24 horas.' },
  'home.busca-placeholder': { pt: 'Digite um cliente, uma tarefa ou um comando…', en: 'Type a client, a task or a command…', es: 'Escriba un cliente, una tarea o un comando…' },
  'home.busca-vazia': { pt: 'Nada com', en: 'Nothing matching', es: 'Nada con' },
  'home.navegar': { pt: 'navegar', en: 'move', es: 'navegar' },
  'home.abrir': { pt: 'abrir', en: 'open', es: 'abrir' },
  'home.fechar': { pt: 'fechar', en: 'close', es: 'cerrar' },
  'home.busca-aria': { pt: 'Buscar ou executar um comando', en: 'Search or run a command', es: 'Buscar o ejecutar un comando' },
  'home.linha-tempo': { pt: 'Linha do tempo de hoje', en: 'Today\'s timeline', es: 'Línea de tiempo de hoy' },
  'home.clientes-antes': { pt: 'Clientes anteriores', en: 'Previous clients', es: 'Clientes anteriores' },
  'home.clientes-mais': { pt: 'Mais clientes', en: 'More clients', es: 'Más clientes' },
  'home.pal-cliente': { pt: 'cliente', en: 'client', es: 'cliente' },
  'home.pal-ir': { pt: 'ir para', en: 'go to', es: 'ir a' },
  'home.pal-tarefa': { pt: 'tarefa', en: 'task', es: 'tarea' },
  'home.em-dia-curto': { pt: 'em dia', en: 'up to date', es: 'al día' },
  'home.vendo-como': { pt: 'vendo como', en: 'viewing as', es: 'viendo como' },
  'home.feito': { pt: 'feito', en: 'done', es: 'hecho' },

  // ---- palavras de tempo e contagem
  'tempo.agora': { pt: 'agora', en: 'just now', es: 'ahora' },
  'tempo.ha': { pt: 'há', en: '', es: 'hace' },
  'tempo.min': { pt: 'min', en: 'min ago', es: 'min' },
  'tempo.h': { pt: 'h', en: 'h ago', es: 'h' },
  'tempo.ontem': { pt: 'ontem', en: 'yesterday', es: 'ayer' },
  'tempo.hoje': { pt: 'hoje', en: 'today', es: 'hoy' },
  'tempo.amanha': { pt: 'amanhã', en: 'tomorrow', es: 'mañana' },
  'tempo.atras': { pt: 'atrás', en: 'ago', es: 'atrás' },
  'comum.dia': { pt: 'dia', en: 'day', es: 'día' },
  'comum.dias': { pt: 'dias', en: 'days', es: 'días' },
  'comum.tarefa': { pt: 'tarefa', en: 'task', es: 'tarea' },
  'comum.tarefas': { pt: 'tarefas', en: 'tasks', es: 'tareas' },

  // ---- status da tarefa
  'status.a_fazer': { pt: 'A fazer', en: 'To do', es: 'Por hacer' },
  'status.em_andamento': { pt: 'Em andamento', en: 'In progress', es: 'En curso' },
  'status.em_revisao': { pt: 'Em revisão', en: 'In review', es: 'En revisión' },
  'status.concluida': { pt: 'Concluída', en: 'Done', es: 'Concluida' },

  // ---- tipo do trabalho (etiqueta na tarefa)
  'tipo.carrossel': { pt: 'Carrossel', en: 'Carousel', es: 'Carrusel' },
  'tipo.reel': { pt: 'Reel', en: 'Reel', es: 'Reel' },
  'tipo.story': { pt: 'Story', en: 'Story', es: 'Story' },
  'tipo.post': { pt: 'Post', en: 'Post', es: 'Publicación' },
  'tipo.criativo': { pt: 'Criativo', en: 'Creative', es: 'Creativo' },
  'tipo.copy': { pt: 'Texto', en: 'Copy', es: 'Texto' },
  'tipo.briefing': { pt: 'Pauta', en: 'Brief', es: 'Pauta' },
  'tipo.landing_page': { pt: 'Página', en: 'Landing', es: 'Página' },
  'tipo.campanha': { pt: 'Campanha', en: 'Campaign', es: 'Campaña' },
  'tipo.video': { pt: 'Vídeo', en: 'Video', es: 'Video' },
  'tipo.tarefa': { pt: 'Tarefa', en: 'Task', es: 'Tarea' },
  'tipo.planejamento': { pt: 'Plano', en: 'Plan', es: 'Plan' },
  'tipo.estrategia': { pt: 'Estratégia', en: 'Strategy', es: 'Estrategia' },

  // ---- o que o cliente mandou (ação do card "chegou do cliente")
  'acao.aprovacao': { pt: 'Ver', en: 'View', es: 'Ver' },
  'acao.ajuste_layout': { pt: 'Corrigir', en: 'Fix', es: 'Corregir' },
  'acao.ajuste_copy': { pt: 'Abrir no Estúdio', en: 'Open in the studio', es: 'Abrir en el estudio' },
  'acao.reprovacao': { pt: 'Abrir', en: 'Open', es: 'Abrir' },
  'acao.corrigir_legenda': { pt: 'Ver', en: 'View', es: 'Ver' },
  'acao.ajuste_aplicado': { pt: 'Ver', en: 'View', es: 'Ver' },
  'acao.solicitacao_conteudo': { pt: 'Abrir', en: 'Open', es: 'Abrir' },

  // ---- grupos do menu lateral
  'grupo.producao': { pt: 'Produção', en: 'Production', es: 'Producción' },
  'grupo.estrategia': { pt: 'Estratégia', en: 'Strategy', es: 'Estrategia' },
  'grupo.crm': { pt: 'Vendas', en: 'Sales', es: 'Ventas' },
  'grupo.comunicacao': { pt: 'Comunicação', en: 'Communication', es: 'Comunicación' },
  'grupo.gestao': { pt: 'Gestão', en: 'Management', es: 'Gestión' },
  'grupo.operacao': { pt: 'Operação', en: 'Operations', es: 'Operación' },
  'grupo.pessoal': { pt: 'Pessoal', en: 'Personal', es: 'Personal' },
  'grupo.clinica': { pt: 'Clínica', en: 'Clinic', es: 'Clínica' },
  'grupo.assessoria': { pt: 'Assessoria', en: 'Advisory', es: 'Asesoría' },
  'grupo.varejo': { pt: 'Varejo', en: 'Retail', es: 'Comercio' },

  // ---- topo do sistema
  'topo.sair': { pt: 'Sair', en: 'Sign out', es: 'Salir' },
  'topo.ver-como': { pt: 'Visualizar como...', en: 'View as...', es: 'Ver como...' },
  'topo.busca': { pt: 'Buscar cliente, tarefa… ou digitar um comando', en: 'Search a client, a task… or type a command', es: 'Buscar cliente, tarea… o escribir un comando' },

  // ---- palavras que aparecem em toda tela
  'comum.salvar': { pt: 'Salvar', en: 'Save', es: 'Guardar' },
  'comum.cancelar': { pt: 'Cancelar', en: 'Cancel', es: 'Cancelar' },
  'comum.fechar': { pt: 'Fechar', en: 'Close', es: 'Cerrar' },
  'comum.voltar': { pt: 'Voltar', en: 'Back', es: 'Volver' },
  'comum.excluir': { pt: 'Excluir', en: 'Delete', es: 'Eliminar' },
  'comum.editar': { pt: 'Editar', en: 'Edit', es: 'Editar' },
  'comum.cliente': { pt: 'Cliente', en: 'Client', es: 'Cliente' },
  'comum.e': { pt: 'e', en: 'and', es: 'y' },
  'comum.opcional': { pt: 'opcional', en: 'optional', es: 'opcional' },
  'comum.salvando': { pt: 'Salvando...', en: 'Saving...', es: 'Guardando...' },
  'comum.enviando': { pt: 'Enviando...', en: 'Sending...', es: 'Enviando...' },

  // ---- tela de criar/editar postagem (PostComposer)
  'composer.titulo-novo': { pt: 'Criar novo post', en: 'Create new post', es: 'Crear nueva publicación' },
  'composer.titulo-editar': { pt: 'Editar post', en: 'Edit post', es: 'Editar publicación' },
  'composer.escolha-cliente': { pt: 'Selecione o cliente...', en: 'Select the client...', es: 'Seleccione el cliente...' },
  'composer.etapa': { pt: 'Etapa do Plano de entregas', en: 'Delivery plan stage', es: 'Etapa del plan de entregas' },
  'composer.etapa-vazia': { pt: 'Nenhuma etapa — crie no Plano de entregas', en: 'No stage yet — create one in the delivery plan', es: 'Ninguna etapa — creála en el plan de entregas' },
  'composer.etapa-escolha': { pt: 'Selecione a etapa...', en: 'Select the stage...', es: 'Seleccione la etapa...' },
  'composer.etapa-aviso-edicao': { pt: 'Escolha a etapa para enviar para aprovação.', en: 'Choose the stage to send it for approval.', es: 'Elija la etapa para enviarlo a aprobación.' },
  'composer.etapa-aviso-novo': { pt: 'Escolha a etapa para salvar, agendar ou enviar para aprovação.', en: 'Choose the stage to save, schedule or send for approval.', es: 'Elija la etapa para guardar, programar o enviar a aprobación.' },
  'composer.etapa-sem-playbook': { pt: 'Este cliente não tem etapas no Plano de entregas. Crie uma etapa antes de publicar/agendar.', en: 'This client has no stages in the delivery plan. Create one before publishing or scheduling.', es: 'Este cliente no tiene etapas en el plan de entregas. Cree una antes de publicar o programar.' },
  'composer.perfis': { pt: 'Perfis', en: 'Profiles', es: 'Perfiles' },
  'composer.perfis-vazio': { pt: 'Selecione ao menos um perfil.', en: 'Select at least one profile.', es: 'Seleccione al menos un perfil.' },
  'composer.publicar-em': { pt: 'Publicar em', en: 'Publish to', es: 'Publicar en' },
  'composer.redes-vazio': { pt: 'Selecione ao menos uma rede.', en: 'Select at least one network.', es: 'Seleccione al menos una red.' },
  'composer.midia': { pt: 'Mídia (imagens ou vídeos)', en: 'Media (images or videos)', es: 'Medios (imágenes o videos)' },
  'composer.anexos-tarefa': { pt: 'Anexos da tarefa de produção', en: 'Files from the production task', es: 'Archivos de la tarea de producción' },
  'composer.enviando-arquivo': { pt: 'Enviando arquivo...', en: 'Uploading file...', es: 'Subiendo archivo...' },
  'composer.arraste': { pt: 'Arraste arquivos aqui ou clique para selecionar', en: 'Drag files here or click to choose', es: 'Arrastre archivos aquí o haga clic para elegir' },
  'composer.formatos-aceitos': { pt: 'JPG, PNG, WEBP, GIF, MP4, MOV — até 500MB', en: 'JPG, PNG, WEBP, GIF, MP4, MOV — up to 500MB', es: 'JPG, PNG, WEBP, GIF, MP4, MOV — hasta 500MB' },
  'composer.drive': { pt: 'Importar mídias do Google Drive', en: 'Import media from Google Drive', es: 'Importar medios de Google Drive' },
  'composer.drive-ordem': { pt: 'As lâminas entram na ordem da numeração (1, 2, 3...).', en: 'Slides are added in the order of their numbering (1, 2, 3...).', es: 'Las láminas entran en el orden de la numeración (1, 2, 3...).' },
  'composer.mover-esquerda': { pt: 'Mover para a esquerda', en: 'Move left', es: 'Mover a la izquierda' },
  'composer.mover-direita': { pt: 'Mover para a direita', en: 'Move right', es: 'Mover a la derecha' },
  'composer.frame-capa': { pt: 'Escolher um frame do vídeo como capa', en: 'Pick a video frame as the cover', es: 'Elegir un fotograma del video como portada' },
  'composer.enviar-capa': { pt: 'Enviar uma imagem de capa', en: 'Upload a cover image', es: 'Subir una imagen de portada' },
  'composer.legenda': { pt: 'Legenda', en: 'Caption', es: 'Texto' },
  'composer.legenda-placeholder': { pt: 'Escreva a legenda do post...', en: 'Write the post caption...', es: 'Escriba el texto de la publicación...' },
  'composer.formato': { pt: 'Formato', en: 'Format', es: 'Formato' },
  'composer.colab': { pt: 'Marcar em colab com outro perfil', en: 'Tag a collaborator profile', es: 'Etiquetar en colaboración con otro perfil' },
  'composer.colab-buscar': { pt: 'Buscar perfil no Instagram...', en: 'Search an Instagram profile...', es: 'Buscar perfil en Instagram...' },
  'composer.data': { pt: 'Data e horário da publicação', en: 'Publishing date and time', es: 'Fecha y hora de publicación' },
  'composer.data-remover': { pt: 'Remover data e horário', en: 'Remove date and time', es: 'Quitar fecha y hora' },
  'composer.data-com': { pt: 'Com data preenchida, o botão publica no horário escolhido (Agendar).', en: 'With a date filled in, the button publishes at the chosen time (Schedule).', es: 'Con fecha, el botón publica en el horario elegido (Programar).' },
  'composer.data-sem': { pt: 'Em branco, o botão publica imediatamente (Publicar agora).', en: 'Left empty, the button publishes immediately (Publish now).', es: 'Vacío, el botón publica de inmediato (Publicar ahora).' },
  'composer.rascunho': { pt: 'Rascunho', en: 'Draft', es: 'Borrador' },
  'composer.salvar-alteracoes': { pt: 'Salvar alterações', en: 'Save changes', es: 'Guardar cambios' },
  'composer.enviar-aprovacao': { pt: 'Enviar para aprovação', en: 'Send for approval', es: 'Enviar a aprobación' },
  'composer.agendar': { pt: 'Agendar', en: 'Schedule', es: 'Programar' },
  'composer.agendando': { pt: 'Agendando...', en: 'Scheduling...', es: 'Programando...' },
  'composer.publicar-agora': { pt: 'Publicar agora', en: 'Publish now', es: 'Publicar ahora' },
  'composer.publicando': { pt: 'Publicando...', en: 'Publishing...', es: 'Publicando...' },
  'composer.rodape-agendar': { pt: '"Enviar para aprovação" gera um link para o cliente. Ao aprovar, agenda para a data escolhida.', en: '"Send for approval" creates a link for the client. On approval, it is scheduled for the chosen date.', es: '"Enviar a aprobación" genera un enlace para el cliente. Al aprobar, se programa para la fecha elegida.' },
  'composer.rodape-publicar': { pt: '"Enviar para aprovação" gera um link para o cliente. Ao aprovar, publica na hora.', en: '"Send for approval" creates a link for the client. On approval, it is published right away.', es: '"Enviar a aprobación" genera un enlace para el cliente. Al aprobar, se publica de inmediato.' },
  'composer.legenda-story': { pt: '(opcional no Story)', en: '(optional on Story)', es: '(opcional en Story)' },
  'composer.video-sem-capa': { pt: 'sem capa. Defina a capa pelo botão "Frame" ou "Capa" para poder publicar ou agendar.', en: 'without a cover. Set it with the "Frame" or "Cover" button before publishing or scheduling.', es: 'sin portada. Defínala con el botón "Frame" o "Portada" antes de publicar o programar.' },
  'composer.video-um': { pt: 'Um vídeo está', en: 'One video is', es: 'Un video está' },
  'composer.videos-varios': { pt: 'vídeos estão', en: 'videos are', es: 'videos están' },
  'composer.previa': { pt: 'Pré-visualização', en: 'Preview', es: 'Vista previa' },
  'composer.legenda-previa': { pt: 'Sua legenda aparecerá aqui...', en: 'Your caption will show up here...', es: 'Su texto aparecerá aquí...' },
  'etapa.marco-inteiro': { pt: 'o marco inteiro', en: 'the whole milestone', es: 'el hito completo' },
  'composer.previa-vazia': { pt: 'Suas imagens/vídeos aparecerão aqui', en: 'Your images and videos will show up here', es: 'Sus imágenes y videos aparecerán aquí' },

  // ---- o que falta para o post sair (lib/composerPendencias)
  'pend.prefixo-agendar': { pt: 'Para agendar', en: 'To schedule', es: 'Para programar' },
  'pend.prefixo-publicar': { pt: 'Para publicar', en: 'To publish', es: 'Para publicar' },
  'pend.prefixo-cliente': { pt: 'Para enviar ao cliente', en: 'To send it to the client', es: 'Para enviarlo al cliente' },
  'pend.cliente': { pt: 'escolher o cliente', en: 'choose the client', es: 'elegir el cliente' },
  'pend.etapa': { pt: 'escolher a etapa do Plano de entregas', en: 'choose the delivery plan stage', es: 'elegir la etapa del plan de entregas' },
  'pend.perfil': { pt: 'marcar ao menos um perfil de destino', en: 'select at least one destination profile', es: 'marcar al menos un perfil de destino' },
  'pend.midia': { pt: 'adicionar ao menos uma mídia', en: 'add at least one media file', es: 'agregar al menos un archivo' },
  'pend.legenda': { pt: 'escrever a legenda', en: 'write the caption', es: 'escribir el texto' },
  'pend.rede': { pt: 'marcar Instagram ou Facebook', en: 'select Instagram or Facebook', es: 'marcar Instagram o Facebook' },
  'pend.capa': { pt: 'definir a capa do vídeo', en: 'set the video cover', es: 'definir la portada del video' },
  'pend.capa-varias': { pt: 'definir a capa de cada vídeo', en: 'set the cover of each video', es: 'definir la portada de cada video' },
  'pend.upload': { pt: 'esperar o envio dos arquivos terminar', en: 'wait for the upload to finish', es: 'esperar a que termine la subida' },
  'pend.ir-etapa': { pt: 'Ir para a etapa', en: 'Go to the stage', es: 'Ir a la etapa' },

  // ---- termos do domínio que aparecem soltos no texto das telas
  'termo.pauta': { pt: 'Pauta', en: 'Brief', es: 'Pauta' },
  'termo.pautas': { pt: 'Pautas', en: 'Briefs', es: 'Pautas' },
  'termo.marco': { pt: 'Marco', en: 'Milestone', es: 'Hito' },
  'termo.etapa': { pt: 'Etapa', en: 'Stage', es: 'Etapa' },
  'termo.quadro': { pt: 'Quadro', en: 'Board', es: 'Tablero' },
  'termo.funil': { pt: 'Funil', en: 'Pipeline', es: 'Embudo' },
  'termo.pagina-captura': { pt: 'Página de captura', en: 'Landing page', es: 'Página de captura' },
  'termo.notepads': { pt: 'Blocos de notas', en: 'Notepads', es: 'Blocs de notas' },
  'termo.microtarefas': { pt: 'Microtarefas', en: 'Quick tasks', es: 'Microtareas' },
  'termo.idioma': { pt: 'Idioma', en: 'Language', es: 'Idioma' },
  'termo.idioma.ajuda': {
    pt: 'Vale só para você. A equipe pode usar o sistema em outro idioma.',
    en: 'Applies to you only. Your teammates can use the system in another language.',
    es: 'Solo para ti. El equipo puede usar el sistema en otro idioma.',
  },
}

/** O texto da chave no idioma pedido. Sem tradução no idioma, cai no português; chave que não
 *  existe volta ela mesma (aparece torto na tela, e é assim que a gente descobre que faltou). */
export function t(chave: string, idioma: Idioma = IDIOMA_PADRAO): string {
  const e = TEXTOS[chave]
  if (!e) return chave
  const v = idioma === 'pt' ? e.pt : e[idioma]
  // Texto VAZIO é escolha (em inglês não existe o "há" de "há 5 min"), não falta de tradução:
  // só cai no português quando a chave não tem nada naquele idioma.
  return v === undefined ? e.pt : v
}

/** Nome da área pela chave da aba (`planner`, `studio`, `playbook`…). */
export const nomeDaArea = (chave: string, idioma: Idioma = IDIOMA_PADRAO): string => t(`nav.${chave}`, idioma)

/** O que veio do banco/localStorage/navegador vira um idioma válido e PRONTO. */
export function normalizarIdioma(v: unknown): Idioma {
  const s = String(v || '').toLowerCase().slice(0, 2)
  const achado = idiomasDisponiveis().find(i => i.chave === s)
  return achado ? achado.chave : IDIOMA_PADRAO
}
