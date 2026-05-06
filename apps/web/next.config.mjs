/**
 * Next.js config.
 *
 * The `/ingest/*` rewrite serves PostHog's snippet, ingest, and decide
 * endpoints from this same origin so the requests look first-party. Avoids
 * default ad-blocker lists that target `*.posthog.com`. Use `eu-assets`
 * (NOT `us-assets`) — picks the EU cloud's static CDN.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
};

export default nextConfig;
