import { NextRequest, NextResponse } from 'next/server'
import { ferramentasPara, executarFerramenta } from '@/lib/assistenteTools'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// Servidor MCP REMOTO do Soma10 (Streamable HTTP) — para plugar o sistema como
// CONECTOR PERSONALIZADO no claude.ai / Claude Code (Configurações → Conectores).
//
// Protocolo: JSON-RPC 2.0 via POST (initialize / tools/list / tools/call / ping),
// stateless (sem Mcp-Session-Id). GET devolve 405 — não oferecemos stream SSE;
// os clientes MCP caem no modo requisição/resposta normalmente.
//
// Ferramentas: as MESMAS do assistente interno (lib/assistenteTools) — consultas
// de tarefas, clientes, CRM, brandboard e financeiro. Só LEITURA por enquanto.
//
// Autorização: o SEGREDO na própria URL (o claude.ai não manda header custom sem
// OAuth). A rota só existe se a env MCP_CONNECTOR_SECRET estiver setada na
// Vercel e o segmento da URL bater com ela. Errou/faltou = 404 sem pista.
// URL a colar no conector: https://<dominio>/api/mcp/<MCP_CONNECTOR_SECRET>

function autorizado(segredo: string): boolean {
  const esperado = process.env.MCP_CONNECTOR_SECRET || ''
  return !!esperado && esperado.length >= 16 && segredo === esperado
}

const json = (corpo: unknown, status = 200) => NextResponse.json(corpo, { status })
const rpcErro = (id: unknown, code: number, message: string) => json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export async function POST(req: NextRequest, { params }: { params: { segredo: string } }) {
  if (!autorizado(params.segredo)) return json({ error: 'not found' }, 404)
  const rl = await checarRate(req, 'mcp-conector', 240, 60); if (rl) return rl

  let msg: any
  try { msg = await req.json() } catch { return rpcErro(null, -32700, 'parse error') }
  if (!msg || typeof msg.method !== 'string') return rpcErro(msg?.id, -32600, 'invalid request')

  // Notificações (sem id) não têm resposta — 202 e pronto.
  if (msg.id === undefined || msg.id === null) {
    return new NextResponse(null, { status: 202 })
  }

  if (msg.method === 'initialize') {
    const pedida = msg.params?.protocolVersion
    return json({
      jsonrpc: '2.0', id: msg.id,
      result: {
        // Ecoa a versão do cliente (somos compatíveis com o fluxo básico de tools).
        protocolVersion: typeof pedida === 'string' && pedida ? pedida : '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'Soma10',
          version: '1.0.0',
          // Ícone do card no cliente MCP (spec 2025-11-25). Cliente que não
          // conhece o campo simplesmente ignora.
          icons: [
            { src: 'https://approval.soma10.com.br/icon-192.png', mimeType: 'image/png', sizes: ['192x192'] },
            { src: 'https://approval.soma10.com.br/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] },
          ],
        },
        instructions: 'Soma10 — sistema de gestão da agência Grupo 10+. Ferramentas de consulta: tarefas da equipe, carteira de clientes, funil de vendas (CRM), Brand Board/Playbook por cliente e resultado financeiro do mês. Responda em português.',
      },
    })
  }

  if (msg.method === 'ping') return json({ jsonrpc: '2.0', id: msg.id, result: {} })

  if (msg.method === 'tools/list') {
    // Mesmo catálogo do assistente interno, com role admin (o segredo é do dono).
    const tools = ferramentasPara('admin').map((t: any) => ({
      name: t.name, description: t.description, inputSchema: t.input_schema,
    }))
    return json({ jsonrpc: '2.0', id: msg.id, result: { tools } })
  }

  if (msg.method === 'tools/call') {
    const nome = msg.params?.name
    if (typeof nome !== 'string' || !nome) return rpcErro(msg.id, -32602, 'params.name obrigatório')
    const texto = await executarFerramenta(nome, msg.params?.arguments || {}, { role: 'admin' })
    let comErro = false
    try { comErro = !!JSON.parse(texto)?.erro } catch { /* texto livre = ok */ }
    return json({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: texto }], isError: comErro } })
  }

  return rpcErro(msg.id, -32601, `método não suportado: ${msg.method}`)
}

// Sem stream SSE: o cliente MCP usa só o POST.
export async function GET(_req: NextRequest, { params }: { params: { segredo: string } }) {
  if (!autorizado(params.segredo)) return json({ error: 'not found' }, 404)
  return new NextResponse(null, { status: 405 })
}

// Encerramento de sessão (clientes que mandam DELETE) — stateless, nada a fazer.
export async function DELETE(_req: NextRequest, { params }: { params: { segredo: string } }) {
  if (!autorizado(params.segredo)) return json({ error: 'not found' }, 404)
  return new NextResponse(null, { status: 200 })
}
