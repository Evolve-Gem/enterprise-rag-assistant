import type { NextConfig } from "next";

/**
 * API proxy target.
 *
 * IMPORTANT: this value is BAKED INTO THE IMAGE at `next build` time, not read at
 * runtime. Next.js evaluates `rewrites()` during the build and freezes the
 * destination URLs, so a runtime env var cannot change them under `next start`
 * (this is a well-known Next.js behaviour). Inside the compose network the
 * backend is always the `backend` service on :8000, so that constant is correct
 * for BOTH the public-IP phase and the domain phase — the domain switch is an
 * Nginx concern outside the container. The value is therefore supplied as a
 * build arg (see Dockerfile.web and docker-compose.yml) and defaults to
 * http://backend:8000. The browser-facing NEXT_PUBLIC_API_BASE_URL stays empty
 * (same-origin) and IS resolved at runtime by the browser, which is what makes
 * the IP<->domain transition need no rebuild.
 */
const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://backend:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not leak the framework banner.
  poweredByHeader: false,
  eslint: {
    // `npm run lint` is the authoritative check; a production build should not
    // be blocked by style warnings.
    ignoreDuringBuilds: false,
  },
  /**
   * Same-origin API.
   *
   * The browser calls `/api/...` on whatever origin served the page and Next
   * proxies it to the backend. Consequences, all deliberate:
   *   - only ONE port ever needs to be exposed publicly (the web service), so
   *     the FastAPI port stays private;
   *   - no CORS, because every request is same-origin;
   *   - `NEXT_PUBLIC_API_BASE_URL` can stay empty, which removes the entire
   *     class of bug where a stale `localhost:8000` is baked into a bundle;
   *   - going from the public-IP phase to the domain phase needs no rebuild,
   *     only an Nginx change.
   */
  async rewrites() {
    return [
      { source: "/health", destination: `${API_PROXY_TARGET}/health` },
      { source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
