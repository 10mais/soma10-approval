'use client'
import React from 'react'

// LIMITE DE ERRO para overlays (dono, 10/09/2026: "o sistema trava quando clica numa
// tarefa, fica em transparência e trava tudo").
//
// Um erro no meio do render de um modal derruba a árvore inteira. Como o modal vai por
// portal para o body, o que sobra na tela é o fundo escurecido, sem painel e sem saída: o
// sistema parece travado. Este limite segura o erro, mostra o que aconteceu e — o que mais
// importa — mantém o botão de FECHAR funcionando.
//
// Regra da casa (ver feedback-overlay-verificar-no-navegador): todo overlay precisa de saída.

type Props = { children: React.ReactNode; onFechar?: () => void; titulo?: string }
type State = { erro: Error | null }

export default class LimiteDeErro extends React.Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error) {
    // O console guarda o rastro para quem for investigar; a tela não trava.
    console.error('[LimiteDeErro]', erro)
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}
        onClick={() => this.props.onFechar?.()}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 440, width: '100%', padding: 22 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--v2-ink)' }}>{this.props.titulo || 'Não foi possível abrir'}</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--v2-ink2)', lineHeight: 1.55 }}>
            Algo neste item quebrou a tela. Nada foi perdido: feche e siga trabalhando. Se acontecer de novo, mande este texto para o suporte.
          </p>
          <p style={{ margin: '0 0 16px', padding: 10, borderRadius: 8, background: 'var(--v2-surface1)', fontSize: 11.5, color: 'var(--v2-ink3)', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
            {String(erro?.message || erro).slice(0, 300)}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => this.props.onFechar?.()} style={{ flex: 1, padding: '11px 0', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
            <button onClick={() => window.location.reload()} style={{ padding: '11px 16px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Recarregar</button>
          </div>
        </div>
      </div>
    )
  }
}
