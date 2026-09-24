import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Vercel preview deployments inject the Vercel Toolbar (comments, feedback).
const isPreview = process.env.VERCEL_ENV === "preview";
const toolbar = (...sources: string[]) => (isPreview ? ` ${sources.join(" ")}` : "");
// Client Components call vedora-api directly (see `useAuth()`).
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").origin;

/**
 * No nonces: they would force every route to render per request, and the
 * landing page is served statically from the CDN. 'unsafe-inline' scripts are
 * still needed for Next's inline bootstrap and the theme script.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${toolbar("https://vercel.live")}`,
  `style-src 'self' 'unsafe-inline'${toolbar("https://vercel.live")}`,
  `img-src 'self' blob: data:${toolbar("https://vercel.live", "https://vercel.com")}`,
  `font-src 'self'${toolbar("https://vercel.live", "https://assets.vercel.com")}`,
  `connect-src 'self' ${apiOrigin}${toolbar("https://vercel.live", "wss://ws-us3.pusher.com")}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `frame-src 'self'${toolbar("https://vercel.live")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Agent rules live in the workspace CLAUDE.md (../CLAUDE.md), not here.
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
