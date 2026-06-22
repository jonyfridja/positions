import type { NextConfig } from "next";

// When the app runs behind a reverse proxy / tunnel (e.g. Cloudflare Tunnel),
// the public host (e.g. tracker.example.com) differs from the internal host the
// server binds to (app:3000). Next.js 15 rejects Server Action POSTs whose Origin
// does not match that internal host unless the public origin is explicitly allowed.
// ALLOWED_ORIGINS is a comma-separated list of public hostnames; it is baked in at
// BUILD time (Next serializes this config), so it is passed as a Docker build arg.
// The real value is provided by CI from a GitHub Actions secret, never committed.
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
