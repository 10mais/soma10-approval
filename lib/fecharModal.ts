import { confirmar } from './toast'
import { clicouNoFundo } from './modalFora'

// Handler de fechar-ao-clicar-fora para os modais do sistema. A regra de "foi
// mesmo um clique no fundo?" mora em lib/modalFora.ts (puro, testado).
//
// Uso:
//   <div onClick={fecharFora(() => setForm(null))} style={{ position:'fixed', inset:0, … }}>
//
// Modal com formulário PERGUNTA antes de descartar (é o padrão): clique fora
// acidental não pode levar o trabalho junto. Passe `perguntar: false` só onde não
// há o que perder — backdrop de menu, visualizador de imagem.
//
// ⚠️ E ONDE O MODAL SALVA SOZINHO (campo a campo, no onBlur/onChange): ali NÃO
// há alteração pendente quando o clique fora acontece — tudo já foi gravado.
// Perguntar "sair sem salvar?" é MENTIRA, e diálogo que mente ensina a clicar
// sem ler; no dia em que a pergunta for verdadeira, ninguém lê. Foi o caso do
// NegocioModal do CRM (relatado pelo dono em 17/07): apliquei a guarda nos 53
// overlays de uma vez, sem separar quem tem botão Salvar de quem salva sozinho.
// A regra: tem botão Salvar → pergunta. Salva sozinho ou não é formulário →
// perguntar: false.
//
// `temAlteracoes` evita a pergunta boba quando o formulário está intocado.

type Opcoes = {
  perguntar?: boolean
  temAlteracoes?: () => boolean
  mensagem?: string
  titulo?: string
}

export function fecharFora(aoFechar: () => void, opts: Opcoes = {}) {
  return (e: { target: unknown; currentTarget: unknown }) => {
    if (!clicouNoFundo(e)) return

    const perguntar = opts.perguntar !== false
    const sujo = opts.temAlteracoes ? opts.temAlteracoes() : true
    if (!perguntar || !sujo) { aoFechar(); return }

    confirmar(opts.mensagem || 'Você tem alterações não salvas.', {
      titulo: opts.titulo || 'Sair sem salvar?',
      okLabel: 'Sair sem salvar',
      cancelLabel: 'Continuar editando',
      perigo: true,
    }).then(ok => { if (ok) aoFechar() })
  }
}
