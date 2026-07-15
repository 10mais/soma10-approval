# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run dev          # Start dev server (Next.js 14, http://localhost:3000)
npm run test         # vitest run — the gate; `npm run build` runs it first
npm run build        # vitest run && next build (a failing test blocks the deploy)
npm run start        # Start production server
```

Type-check without emitting (use the local TypeScript, not npx):
```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Validate changes with **both** `npm run test` and `tsc --noEmit` before committing.
Tests live in `tests/*.test.ts` (vitest, `@/lib` alias) and cover pure logic in
`lib/` — every new lib gets one. Since `build` runs them, a broken test breaks the
deploy of **every** instance at once (see INSTANCIAS.md) — that is the point.

## Deployment

Push to `main` → GitHub → Vercel auto-deploys. Domain: `approval.soma10.com.br`. Vercel Pro plan (300s function timeout, 500MB blob uploads).

## Architecture

This is a **social media management SaaS** for agency "Grupo 10+" built as a single Next.js 14 App Router application with no separate backend.

### Data layer
- **Upstash Redis** — all data (users, clients, posts, plans, tasks, marcos, notifications, chat). No SQL database. All types in `lib/redis.ts`.
- **Vercel Blob** — media storage (images, videos, documents). Client-side upload via `@vercel/blob/client` → `/api/upload` authorizer.
- Key patterns: `usuario:{email}`, `cliente:{id}`, `post:{id}`, `plano:{id}`, `tarefa:{id}`, `marco:{id}`, `notificacao:{id}`. Sets for indexes: `usuarios`, `clientes`, `posts`, `agendados`, `planos`, `tarefas`, `marcos`, `plano:{id}:pautas`.

### Auth
- **NextAuth** with credentials provider (`lib/auth.ts`). Passwords hashed with bcrypt.
- Three roles: `admin` (full access), `gerente` (operational), `cliente` (restricted to own project).
- Session accessed via `getServerSession(authOptions)` in API routes. Role at `(session.user as any).role`, clienteId at `(session.user as any).clienteId`.

### Publishing pipeline
- `lib/publicar.ts` — central publishing logic. `processarPublicacao(post, cliente)` publishes to Instagram (graph.instagram.com) and/or Facebook (graph.facebook.com).
- **Anti-duplication**: `redesPublicadas[]` saved atomically per-network after each successful publish. Never republishes a network already marked.
- Video upload to Facebook uses direct multipart upload (not file_url) to avoid fetch failures.
- Cron (`/api/cron/publicar`) runs externally (cron-job.org every 1 min). Removes post from `agendados` index BEFORE publishing to prevent race conditions.

### Creative pipeline (Esteira)
- Posts have an `etapa` field: `briefing` → `copy` → `aprovacao_copy` → `criativo` → `aprovacao_criativo` → `pronto`.
- Posts with `etapa` only appear in Planner at `pronto` (or `aprovacao_copy`/`aprovacao_criativo` for the approval screen).
- `Plano` groups pautas by client+month. AI generates plans via `/api/esteira/gerar-plano`.
- Approval automation in `/api/esteira/aprovar`: advances stages, auto-schedules on criativo approval.

### AI integration
- **Anthropic Claude** (claude-opus-4-8) via `@anthropic-ai/sdk` for:
  - Brand document generation (`/api/brand/gerar-documento`)
  - Monthly plan generation (`/api/esteira/gerar-plano`)
  - Individual caption generation (`/api/esteira/gerar-legenda`)
- Credit tracking in `lib/anthropicSaldo.ts` (estimated balance, alerts admins).

### Key conventions
- **No emojis in UI** — use SVG icons only. Icon components defined at top of `app/dashboard/page.tsx` (Icon, IconSearch, IconTrash, etc.).
- All UI text in Portuguese (pt-BR).
- The main dashboard (`app/dashboard/page.tsx`) is a large single-page app with tab-based navigation via `aba` state (persisted in sessionStorage).
- `verComoClienteId` state filters everything to a specific client view.
- Client-facing portal: when `role === 'cliente'`, shows simplified nav (Aprovacoes, Esteira, Playbook only).

### Environment variables
Required: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
Instagram: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`.
AI: `ANTHROPIC_API_KEY`.
Optional: `YOUTUBE_API_KEY`, `CRON_SECRET`, `META_API_VERSION_PUBLISH`.

### Important patterns
- API routes use spread `{ ...post, ...resultado.campos }` for updates — be careful with field overwrites.
- `@/lib/redis` path alias resolves to `./lib/redis` via tsconfig paths.
- Notifications go to activity owner (`notificarDono`) not entire team, with fallback to `notificarEquipe`.
- File uploads limited to 500MB. Images auto-compressed client-side (1440px max, JPEG 90%).
