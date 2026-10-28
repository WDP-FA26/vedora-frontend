import type { NextConfig } from "next";

// Validates the public environment when the server starts (see lib/env.ts).
import { PUBLIC_ENV } from "./lib/env";

const isDev = process.env.NODE_ENV === "development";
// Vercel preview deployments inject the Vercel Toolbar (comments, feedback).
const isPreview = process.env.VERCEL_ENV === "preview";
const toolbar = (...sources: string[]) => (isPreview ? ` ${sources.join(" ")}` : "");
// Client Components call vedora-api directly (see `useAuth()`).
const apiOrigin = new URL(PUBLIC_ENV.apiUrl).origin;
// Cloudinary: signed direct uploads (api.cloudinary.com); HLS streams, posters
// and caption files (res.cloudinary.com).
const cloudinaryUpload = "https://api.cloudinary.com";
const cloudinaryCdn = "https://res.cloudinary.com";
// CldVideoPlayer loads its pinned player build from unpkg. Its source map is
// fetched through connect-src, so the same path is allowed there too.
const cloudinaryPlayer = "https://unpkg.com/cloudinary-video-player@1.11.1/";
const storageOrigin = new URL(PUBLIC_ENV.storageUrl).origin;
// Dish photos are hot-linked, not stored: only these free-licence hosts may serve them.
// Keep in sync with DISH_IMAGE_HOSTS in features/recipes/schemas.ts.
const dishImages = "https://upload.wikimedia.org https://images.unsplash.com https://images.pexels.com";
// Cloudflare Turnstile: the script and the challenge iframe of the guest chat.
const turnstile = "https://challenges.cloudflare.com";

/**
 * No nonces: they would force every route to render per request, and the
 * landing page is served statically from the CDN. 'unsafe-inline' scripts are
 * still needed for Next's inline bootstrap and the theme script.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${cloudinaryPlayer} ${turnstile}${toolbar("https://vercel.live")}`,
  `style-src 'self' 'unsafe-inline'${toolbar("https://vercel.live")}`,
  `img-src 'self' blob: data: ${cloudinaryCdn} ${storageOrigin} https://vietqr.app ${dishImages}${toolbar("https://vercel.live", "https://vercel.com")}`,
  // The Cloudinary player's icon font is inlined as a data: URI.
  `font-src 'self' data:${toolbar("https://vercel.live", "https://assets.vercel.com")}`,
  `connect-src 'self' ${apiOrigin} ${cloudinaryUpload} ${cloudinaryCdn} ${storageOrigin} ${cloudinaryPlayer}${toolbar("https://vercel.live", "wss://ws-us3.pusher.com")}`,
  `media-src 'self' blob: ${cloudinaryCdn}`,
  "worker-src 'self' blob:",
  `frame-src 'self' ${turnstile}${toolbar("https://vercel.live")}`,
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
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
