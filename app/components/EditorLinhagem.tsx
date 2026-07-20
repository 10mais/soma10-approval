'use client'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { ordenarLinhagem, type PessoaLinhagem } from '@/lib/linhagem'
import ArvoreLinhagem from './ArvoreLinhagem'

// Editor da linhagem de um processo: cada linha é uma pessoa da cadeia de prova
// (do requerente ao ascendente estrangeiro). Datas são TEXTO livre de propósito
// (certidão antiga tem data parcial). Um único ascendente marcado.

const novaPessoa = (geracao: number): PessoaLinhagem => ({ id: uuid(), nome: '', geracao })

export default function EditorLinhagem({ value, onChange }: { value: PessoaLinhagem[]; onChange: (v: PessoaLinhagem[]) => void }) {
  const [verArvore, setVerArvore] = useState(false)
  const lista = value || []

  function set(id: string, campo: keyof PessoaLinhagem, val: any) {
    onChange(lista.map(p => p.id === id ? { ...p, [campo]: val } : p))
  }
  function marcarAscendente(id: string) {
    // Exclusivo: marcar um desmarca os demais.
    onChange(lista.map(p => ({ ...p, ascendente: p.id === id ? !p.ascendente : false })))
  }
  function add() {
    const maxGer = lista.reduce((m, p) => Math.max(m, p.geracao), -1)
    onChange([...lista, novaPessoa(maxGer + 1)])
  }
  function remover(id: string) {
    onChange(lista.filter(p => p.id !== id))
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6b7280', margin: '0 0 3px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }

  // Mostra na ordem da cadeia (base → topo) para a edição fazer sentido.
  const ordenada = ordenarLinhagem(lista)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280' }}>Do requerente (geração 0) ao ascendente estrangeiro. Marque quem é o ascendente.</p>
        {lista.length > 0 && (
          <button type="button" onClick={() => setVerArvore(v => !v)} style={{ padding: '4px 10px', background: verArvore ? '#eef2ff' : '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {verArvore ? 'Editar' : 'Ver árvore'}
          </button>
        )}
      </div>

      {verArvore ? (
        <div style={{ padding: 12, background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 10 }}>
          <ArvoreLinhagem pessoas={lista} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordenada.map(p => (
            <div key={p.id} style={{ border: '1px solid ' + (p.ascendente ? '#c7d2fe' : '#eef0f2'), background: p.ascendente ? '#eef2ff' : '#fff', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Nome</label>
                  <input value={p.nome} onChange={e => set(p.id, 'nome', e.target.value)} placeholder="Nome completo" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Papel</label>
                  <input value={p.papel || ''} onChange={e => set(p.id, 'papel', e.target.value)} placeholder="Avô…" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Geração</label>
                  <input type="number" min={0} value={p.geracao} onChange={e => set(p.id, 'geracao', Math.max(0, Math.floor(Number(e.target.value) || 0)))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={labelStyle}>Sexo</label>
                  <select value={p.sexo || ''} onChange={e => set(p.id, 'sexo', e.target.value || undefined)} style={inputStyle}>
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Nascimento</label>
                  <input value={p.nascimento || ''} onChange={e => set(p.id, 'nascimento', e.target.value)} placeholder="1878 / 12/03/1878" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Local de nascimento</label>
                  <input value={p.nascimentoLocal || ''} onChange={e => set(p.id, 'nascimentoLocal', e.target.value)} placeholder="Cidade / país" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={labelStyle}>Casamento</label>
                  <input value={p.casamento || ''} onChange={e => set(p.id, 'casamento', e.target.value)} placeholder="Data (livre)" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Óbito</label>
                  <input value={p.obito || ''} onChange={e => set(p.id, 'obito', e.target.value)} placeholder="Data (livre)" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!p.ascendente} onChange={() => marcarAscendente(p.id)} />
                  Ascendente estrangeiro
                </label>
                <button type="button" onClick={() => remover(p.id)} style={{ padding: '4px 10px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: '#b91c1c', cursor: 'pointer' }}>Remover</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={add} style={{ padding: '8px 0', background: '#fff', border: '1px dashed #d1d5db', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>+ Adicionar pessoa à linhagem</button>
        </div>
      )}
    </div>
  )
}
