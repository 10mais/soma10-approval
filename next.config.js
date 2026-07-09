/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['*'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Chromium headless (motor de criativos) usa binário/requires nativos — não pode
  // ser empacotado pelo webpack; declara como externo do lado servidor.
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  },
}
module.exports = nextConfig
