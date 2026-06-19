import type { NextConfig } from "next";

// When the app runs behind a reverse proxy / tunnel (e.g. Cloudflare Tunnel),
// the public host (tracker.jony.fr) differs from the internal host the server
// binds to (app:3000). Next.js 15 rejects Server Action POSTs whose Origin does
// not match that internal host unless the public origin is explicitly allowed.
// Set ALLOWED_ORIGINS to a comma-separated list of public hostnames in prod.
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  ...(allowedOrigins?.length
    ? { experimental: { serverActions: { allowedOrigins } } }
    : {}),
};

export default nextConfig;
