import type { NextConfig } from "next";

/**
 * API proxy target.
 *
 * Read when the server process starts (next.config is evaluated by `next start`),
 * so this is a RUNTIME setting, not a build-time one. In Docker it points at the
 * compose service (`http://backend:8000`); locally it defaults to the dev
 * backend. Because it is runtime, ONE built image works in every environment and
 * the API host can change without rebuilding.
 */
const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://127.0.0.1:8000").replace(/\/$/, "");

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
