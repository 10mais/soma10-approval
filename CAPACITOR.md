# App nas lojas (Capacitor) — guia de empacotamento

Este projeto já é uma **PWA instalável** (funciona no celular via "Adicionar à tela inicial").
Este guia é a **etapa 2**: publicar como app nativo na **App Store** e na **Google Play** usando o Capacitor.

## Como funciona aqui (modo hospedado)

Como o Soma10 é um Next.js com SSR, API routes, NextAuth e Redis, ele **não** é um site estático.
Por isso o Capacitor está configurado em **modo hospedado**: o app nativo é uma casca que carrega
`https://approval.soma10.com.br` (ver `capacitor.config.json` → `server.url`).

Vantagem: **atualizações de conteúdo/telas continuam saindo pela Vercel** (push na `main`), sem
precisar resubmeter o app nas lojas. Só é preciso resubmeter quando muda algo **nativo** (ícone,
splash, versão, plugins).

## Pré-requisitos (ação do dono)

- **Conta Apple Developer** — US$ 99/ano (para App Store). Precisa de um **Mac com Xcode**.
- **Conta Google Play Console** — US$ 25 (taxa única). Precisa de **Android Studio**.
- Node 18+ instalado.

## Passo a passo

1. Instalar as dependências do Capacitor:

   ```bash
   npm i -D @capacitor/cli
   npm i @capacitor/core @capacitor/android @capacitor/ios
   ```

2. Adicionar as plataformas (gera as pastas nativas `android/` e `ios/` — já ignoradas no git):

   ```bash
   npx cap add android
   npx cap add ios        # só no macOS
   ```

3. Sincronizar a config:

   ```bash
   npx cap sync
   ```

4. Abrir os projetos nativos para configurar ícone, splash, assinatura e gerar o build:

   ```bash
   npx cap open android   # abre no Android Studio
   npx cap open ios        # abre no Xcode (macOS)
   ```

5. **Ícone e splash nativos:** use os assets em `public/` (`icon-512.png`, `public/splash/`) ou gere
   com `@capacitor/assets` (`npx @capacitor/assets generate`). No modo hospedado, a splash **nativa**
   é a da loja/app; as splash de PWA em `public/splash` valem só para o "Adicionar à tela inicial".

6. **Build e submissão:**
   - Android: no Android Studio, gerar um **Android App Bundle (.aab)** assinado → subir no Play Console.
   - iOS: no Xcode, **Archive** → distribuir via App Store Connect.

## Observações

- **Login/cookies:** o modo hospedado usa o webview; o NextAuth funciona normalmente pois é o mesmo
  domínio. Se houver bloqueio de cookies no webview iOS, avaliar `WKAppBoundDomains`.
- **Push nativo (opcional):** o **web push já funciona na PWA**. Para push nativo (APNs/FCM) via
  loja, adicionar depois `@capacitor/push-notifications` + configurar FCM/APNs.
- **Deep links / domínio:** para abrir links `approval.soma10.com.br` direto no app, configurar
  Universal Links (iOS) / App Links (Android) — passo posterior, opcional.
- Nunca commitar chaves de assinatura (`.keystore`, `.p12`, perfis) — mantê-las fora do git.
