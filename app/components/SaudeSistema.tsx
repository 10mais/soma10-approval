'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast, confirmar } from '@/lib/toast'

type Integracao = { chave: string; label: string; ligado: boolean; obs?: string }
type RegistroErro = { id: string; escopo: string; mensagem: string; stack?: string; criadoEm: string }
type RegistroAuditoria = { id: string; ator: string; acao: string; alvo?: string; detalhe?: string; criadoEm: string }
type Dados = {
  integracoes: Integracao[]
  erros: RegistroErro[]
  auditoria: RegistroAuditoria[]
  ultimoBackup: { pathname: string; tamanho: number; em: string } | null
  backups: { pathname: string; tamanho: number; em: string }[]
  ts: string
}

const ESSENCIAIS = ['redis', 'blob', 'auth', 'anthropic', 'meta']
const ACAO_LABEL: Record<string, string> = {
  cliente_excluido: 'Cliente excluído',
  colaborador_criado: 'Colaborador criado',
  colaborador_excluido: 'Colaborador excluído',
  senha_resetada: 'Senha redefinida',
  permissoes_papel_alteradas: 'Permissões por papel alteradas',
  permissoes_granular_alteradas: 'Permissões detalhadas alteradas',
  backup_restaurado: 'Backup restaurado',
  '2fa_ativado': 'Verificação em 2 fatores ativada',
  '2fa_desativado': 'Verificação em 2 fatores desativada',
  '2fa_resetado': 'Verificação em 2 fatores resetada (admin)',
}

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
  // Restauração de backup (zona de risco)
  const [bkp, setBkp] = useState<any>(null) // backup enviado por arquivo (alternativa)
  const [selPath, setSelPath] = useState('') // backup gerenciado escolhido (primário)
  const [conf, setConf] = useState('')
  const [restaurando, setRestaurando] = useState(false)

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

  function onArquivoBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const j = JSON.parse(String(reader.result))
        if (!j?._meta) { toast('Este arquivo não parece um backup válido.', 'erro'); return }
        setBkp(j); setSelPath(''); setConf('')
      } catch { toast('Não foi possível ler o arquivo.', 'erro') }
    }
    reader.readAsText(f)
  }

  async function restaurar() {
    const temFonte = !!selPath || !!bkp
    if (!temFonte || conf !== 'RESTAURAR' || restaurando) return
    if (!(await confirmar('Restaurar este backup? Os registros do backup vão SOBRESCREVER os atuais. Não apaga o que foi criado depois, mas não dá para desfazer o que for sobrescrito.', { titulo: 'Restaurar backup', okLabel: 'Restaurar agora', perigo: true }))) return
    setRestaurando(true)
    const body = selPath ? { pathname: selPath, confirmar: 'RESTAURAR' } : { dados: bkp, confirmar: 'RESTAURAR' }
    const r = await fetch('/api/backup/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null)
    setRestaurando(false)
    if (r?.ok) { toast('Backup restaurado com sucesso.', 'sucesso'); setBkp(null); setSelPath(''); setConf(''); carregar() }
    else toast(r?.error || 'Falha ao restaurar.', 'erro')
  }

  function copiarHealth() {
    const url = `${location.origin}/api/health`
    navigator.clipboard?.writeText(url).then(() => toast('URL de monitoramento copiada.', 'sucesso')).catch(() => toast(url, 'info'))
  }

  if (carregando && !dados) return <p style={{ fontSize: 13, color: '#aaa' }}>Verificando o sistema...</p>
  if (erroFetch) return <p style={{ fontSize: 13, color: '#e11' }}>Não foi possível carregar o diagnóstico.</p>
  if (!dados) return null

  const essenciaisOff = dados.integracoes.filter(i => ESSENCIAIS.includes(i.chave) && !i.ligado)
  const temErros = dados.erros.length > 0
  const cont = bkp?._meta?.contagens

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

      {/* Monitoramento de uptime (turnkey) */}
      <div>
        <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#333' }}>Monitoramento de uptime</h4>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#999' }}>Cole esta URL num monitor gratuito (ex.: UptimeRobot, BetterStack) — ele te avisa se o site cair. Responde 200 quando tudo está no ar, 503 se o banco cai.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <code style={{ fontSize: 12, background: '#f4f4f5', padding: '7px 10px', borderRadius: 8, color: '#333' }}>{typeof location !== 'undefined' ? `${location.origin}/api/health` : '/api/health'}</code>
          <button onClick={copiarHealth} style={{ padding: '7px 12px', background: '#f2f2f2', color: '#333', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Copiar</button>
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

      {/* Auditoria — quem fez o quê */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#333' }}>
          Auditoria — quem fez o quê {dados.auditoria.length ? `(${dados.auditoria.length})` : ''}
        </h4>
        {!dados.auditoria.length ? (
          <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Nenhuma ação sensível registrada ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
            {dados.auditoria.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 11px', borderRadius: 9, border: '1px solid #eee', background: '#fafafa' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', flexShrink: 0 }}>{ACAO_LABEL[a.acao] || a.acao}</span>
                {a.alvo && <span style={{ fontSize: 12, color: '#333' }}>· {a.alvo}</span>}
                <span style={{ fontSize: 11.5, color: '#888', marginLeft: 'auto', flexShrink: 0 }}>{a.ator} · {tempoRelativo(a.criadoEm)}</span>
              </div>
            ))}
          </div>
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

      {/* Zona de risco — restaurar backup */}
      <div style={{ border: '1.5px solid #fecaca', borderRadius: 12, padding: 16, background: '#fef7f7' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>Zona de risco — Restaurar backup</h4>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#a15656' }}>Recuperação de desastre. Sobrescreve os registros atuais com os do backup (não apaga o que foi criado depois). Use só se precisar recuperar dados perdidos.</p>

        {/* Primário: backup gerenciado (lido no servidor, sem limite de tamanho) */}
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#7a4a4a', marginBottom: 4 }}>Backup gerenciado (diário)</label>
        <select value={selPath} onChange={e => { setSelPath(e.target.value); setBkp(null); setConf('') }} style={{ width: '100%', maxWidth: 320, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0c0c0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', marginBottom: 10 }}>
          <option value="">Escolher um backup…</option>
          {(dados.backups || []).map(b => <option key={b.pathname} value={b.pathname}>{b.pathname.replace('backups/', '').replace('.json', '')} · {formatarKB(b.tamanho)}</option>)}
        </select>

        <div style={{ fontSize: 11.5, color: '#a15656', margin: '0 0 6px' }}>ou envie um arquivo baixado (Config → Geral · até ~4,5MB):</div>
        <input type="file" accept="application/json,.json" onChange={onArquivoBackup} style={{ fontSize: 12.5, marginBottom: 10, display: 'block' }} />
        {bkp && cont && (
          <div style={{ marginBottom: 10, fontSize: 12, color: '#555' }}>
            <div style={{ fontWeight: 700, color: '#333', marginBottom: 3 }}>Arquivo carregado{bkp._meta?.geradoEm ? ` (gerado ${new Date(bkp._meta.geradoEm).toLocaleString('pt-BR')})` : ''}:</div>
            {cont.clientes ?? 0} clientes · {cont.usuarios ?? 0} usuários · {cont.posts ?? 0} posts · {cont.tarefas ?? 0} tarefas · {cont.marcos ?? 0} marcos
          </div>
        )}
        {(bkp || selPath) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#555' }}>Para confirmar, digite <b>RESTAURAR</b>:</span>
            <input value={conf} onChange={e => setConf(e.target.value)} placeholder="RESTAURAR" style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0c0c0', fontSize: 12.5, width: 130, fontFamily: 'inherit' }} />
            <button onClick={restaurar} disabled={conf !== 'RESTAURAR' || restaurando} style={{ padding: '8px 16px', background: conf === 'RESTAURAR' ? '#b91c1c' : '#eee', color: conf === 'RESTAURAR' ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12.5, cursor: conf === 'RESTAURAR' && !restaurando ? 'pointer' : 'not-allowed' }}>{restaurando ? 'Restaurando…' : 'Restaurar backup'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
