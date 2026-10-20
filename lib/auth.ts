import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { redis, Usuario } from './redis'
import { verificarCodigo } from './twoFactor'
import { verificarCodigoEmail } from './twoFactorEmail'
import { doisFatoresGlobalAtivo } from './seguranca'
import { loginBloqueado, registrarFalhaLogin, limparFalhasLogin } from './loginThrottle'
import bcrypt from 'bcryptjs'

// De quanto em quanto tempo a sessão relê papel e permissões no banco (ver o callback jwt).
const RELER_USUARIO_MS = 60 * 1000

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        codigo: { label: 'Código 2FA', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Proteção contra força bruta: bloqueia temporariamente após muitas falhas.
        if (await loginBloqueado(credentials.email)) return null

        const usuario = await redis.get<Usuario>(`usuario:${credentials.email}`)
        if (!usuario) { await registrarFalhaLogin(credentials.email); return null }

        const senhaCorreta = await bcrypt.compare(credentials.password, usuario.senha)
        if (!senhaCorreta) { await registrarFalhaLogin(credentials.email); return null }

        // Verificação em 2 fatores — SÓ se o interruptor GLOBAL estiver ligado E o
        // usuário tiver ativado. Global desligado (padrão) = login normal, sem código
        // (protege o App Review da Meta). App (TOTP) ou e-mail.
        if (usuario.twoFactorEnabled && await doisFatoresGlobalAtivo()) {
          const met = usuario.twoFactorMethod || 'app'
          const codOk = met === 'email'
            ? await verificarCodigoEmail(credentials.email, credentials.codigo || '')
            : await verificarCodigo(credentials.codigo || '', usuario.twoFactorSecret)
          if (!codOk) { await registrarFalhaLogin(credentials.email); return null }
        }

        await limparFalhasLogin(credentials.email) // login OK: zera o contador
        return { id: usuario.id, name: usuario.nome, email: usuario.email, role: usuario.role, clienteId: usuario.clienteId, lojaId: usuario.lojaId, permissoes: usuario.permissoes, permissoesGranular: usuario.permissoesGranular } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.clienteId = (user as any).clienteId
        ;(token as any).lojaId = (user as any).lojaId
        ;(token as any).permissoes = (user as any).permissoes
        ;(token as any).permissoesGranular = (user as any).permissoesGranular
        ;(token as any).lidoEm = Date.now()
        return token
      }
      // Permissões VIVAS (dono, 20/10/2026: "Já adicionei permissões, mas não atualizou" — Ana).
      // Papel e permissões eram copiados SÓ no login: o que o admin mudava depois só valia quando
      // a pessoa saía e entrava. Agora o token relê o usuário no banco a cada minuto.
      if (token.email && Date.now() - ((token as any).lidoEm || 0) > RELER_USUARIO_MS) {
        try {
          const u = await redis.get<Usuario>(`usuario:${token.email}`)
          if (u) {
            token.role = u.role
            token.clienteId = u.clienteId
            ;(token as any).lojaId = u.lojaId
            ;(token as any).permissoes = u.permissoes
            ;(token as any).permissoesGranular = u.permissoesGranular
          }
          ;(token as any).lidoEm = Date.now()
        } catch { /* banco fora do ar: segue com o que o token já tem */ }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role
        ;(session.user as any).clienteId = token.clienteId
        ;(session.user as any).lojaId = (token as any).lojaId
        ;(session.user as any).permissoes = (token as any).permissoes
        ;(session.user as any).permissoesGranular = (token as any).permissoesGranular
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'soma10-secret-2026',
}
