'use client'
import { useEffect, useState, useCallback } from 'react'

type Integracao = { chave: string; label: string; ligado: boolean; obs?: string }
type RegistroErro = { id: string; escopo: string; mensagem: string; stack?: string; criadoEm: string }
type Dados = {
  integracoes: Integracao[]
  erros: RegistroErro[]
  ultimoBackup: { pathname: string; tamanho: number; em: string } | null
  ts: string
}

// Chaves que são ESSENCIAIS (sistema não opera bem sem elas). As demais são opcionais.
const ESSENCIAIS = ['redis', 'blob', 'auth', 'anthropic', 'meta']

function tempoRelativo(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  return `há ${dias}d`
}

function formatarKB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function SaudeSistema() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroFetch, setErroFetch] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErroFetch(false)
    fetch('/api/sistema')
      .then(r => r.json())
      .then(d => { if (d && !d.error) setDados(d); else setErroFetch(true) })
      .catch(() => setErroFetch(true))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando && !dados) return <p style={{ fontSize: 13, color: '#aaa' }}>Verificando o sistema...</p>
  if (erroFetch) return <p style={{ fontSize: 13, color: '#e11' }}>Não foi possível carregar o diagnóstico.</p>
  if (!dados) return null

  const essenciaisOff = dados.integracoes.filter(i => ESSENCIAIS.includes(i.chave) && !i.ligado)
  const temErros = dados.erros.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Resumo de topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999,
          background: essenciaisOff.length ? '#fdecec' : '#eafaf0', color: essenciaisOff.length ? '#c0392b' : '#1a7d4b',
          fontSize: 13, fontWeight: 800,
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: essenciaisOff.length ? '#e74c3c' : '#27ae60', display: 'inline-block' }} />
          {essenciaisOff.length ? `${essenciaisOff.length} essencial(is) faltando` : 'Essenciais no ar'}
        </div>
        <button onClick={carregar} disabled={carregando} style={{ padding: '7px 14px', background: '#f2f2f2', color: '#333', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
          {carregando ? 'Atualizando...' : 'Atualizar'}
        </button>
        <span style={{ fontSize: 11, color: '#bbb' }}>Verificado {tempoRelativo(dados.ts)}</span>
      </div>

      {/* Integrações */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#333' }}>Integrações</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          {dados.integracoes.map(i => {
            const essencial = ESSENCIAIS.includes(i.chave)
            return (
              <div key={i.chave} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #eee', background: '#fff' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: i.ligado ? '#27ae60' : (essencial ? '#e74c3c' : '#c9c9c9') }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</div>
                  <div style={{ fontSize: 11, color: i.ligado ? '#2a9d5c' : (essencial ? '#c0392b' : '#aaa') }}>
                    {i.ligado ? 'Configurado' : (essencial ? 'FALTANDO' : 'Não configurado')}{i.obs ? ` · ${i.obs}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Backup */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#333' }}>Último backup</h4>
        {dados.ultimoBackup ? (
          <div style={{ fontSize: 12.5, color: '#555' }}>
            <strong style={{ color: '#222' }}>{dados.ultimoBackup.pathname.replace('backups/', '')}</strong>
            {' · '}{formatarKB(dados.ultimoBackup.tamanho)}
            {dados.ultimoBackup.em ? ` · ${tempoRelativo(dados.ultimoBackup.em)}` : ''}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nenhum backup encontrado ainda (o cron roda diariamente às 6h).</p>
        )}
      </div>

      {/* Erros recentes */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#333' }}>
          Erros recentes {temErros ? `(${dados.erros.length})` : ''}
        </h4>
        {!temErros ? (
          <p style={{ margin: 0, fontSize: 12.5, color: '#2a9d5c' }}>Nenhum erro registrado nos últimos 14 dias.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
            {dados.erros.map(e => (
              <div key={e.id} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #f2dede', background: '#fdf6f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#c0392b' }}>{e.escopo}</span>
                  <span style={{ fontSize: 10.5, color: '#bbb', flexShrink: 0 }}>{tempoRelativo(e.criadoEm)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#444', marginTop: 3, wordBreak: 'break-word' }}>{e.mensagem}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
