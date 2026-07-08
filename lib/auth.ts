import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { redis, Usuario } from './redis'
import { verificarCodigo } from './twoFactor'
import { verificarCodigoEmail } from './twoFactorEmail'
import { loginBloqueado, registrarFalhaLogin, limparFalhasLogin } from './loginThrottle'
import bcrypt from 'bcryptjs'

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

        // Verificação em 2 fatores — SÓ para quem ativou (opt-in). Sem 2FA ativo,
        // o login segue exatamente como antes. App (TOTP) ou e-mail (código enviado).
        if (usuario.twoFactorEnabled) {
          const met = usuario.twoFactorMethod || 'app'
          const codOk = met === 'email'
            ? await verificarCodigoEmail(credentials.email, credentials.codigo || '')
            : await verificarCodigo(credentials.codigo || '', usuario.twoFactorSecret)
          if (!codOk) { await registrarFalhaLogin(credentials.email); return null }
        }

        await limparFalhasLogin(credentials.email) // login OK: zera o contador
        return { id: usuario.id, name: usuario.nome, email: usuario.email, role: usuario.role, clienteId: usuario.clienteId, permissoes: usuario.permissoes, permissoesGranular: usuario.permissoesGranular } as any
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.clienteId = (user as any).clienteId
        ;(token as any).permissoes = (user as any).permissoes
        ;(token as any).permissoesGranular = (user as any).permissoesGranular
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role
        ;(session.user as any).clienteId = token.clienteId
        ;(session.user as any).permissoes = (token as any).permissoes
        ;(session.user as any).permissoesGranular = (token as any).permissoesGranular
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'soma10-secret-2026',
}
