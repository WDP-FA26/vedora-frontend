import type { NextConfig } from "next";

import { PUBLIC_ENV } from "./lib/env";

const isDev = process.env.NODE_ENV === "development";
const isPreview = process.env.VERCEL_ENV === "preview";
const toolbar = (...sources: string[]) => (isPreview ? ` ${sources.join(" ")}` : "");
const apiOrigin = new URL(PUBLIC_ENV.apiUrl).origin;
const cloudinaryUpload = "https://api.cloudinary.com";
const cloudinaryCdn = "https://res.cloudinary.com";
const cloudinaryPlayer = "https://unpkg.com/cloudinary-video-player@1.11.1/";
const cloudinaryPlayerStyles = "https://unpkg.com/cloudinary-video-player@1.11.1/dist/cld-video-player.min.css";
const cloudinaryAnalytics = "https://analytics-api-s.cloudinary.com";
const storageOrigin = new URL(PUBLIC_ENV.storageUrl).origin;
const dishImages = "https://upload.wikimedia.org https://images.unsplash.com https://images.pexels.com";
const mapbox = "https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com";
const aiGatewayRealtime = "wss://ai-gateway.vercel.sh";
const turnstile = "https://challenges.cloudflare.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} ${cloudinaryPlayer} ${turnstile}${toolbar("https://vercel.live")}`,
  `style-src 'self' 'unsafe-inline' ${cloudinaryPlayerStyles}${toolbar("https://vercel.live")}`,
  `img-src 'self' blob: data: ${cloudinaryCdn} ${storageOrigin} https://vietqr.app ${dishImages}${toolbar("https://vercel.live", "https://vercel.com")}`,
  `font-src 'self' data:${toolbar("https://vercel.live", "https://assets.vercel.com")}`,
  `connect-src 'self' ${apiOrigin} ${cloudinaryUpload} ${cloudinaryCdn} ${cloudinaryAnalytics} ${storageOrigin} ${cloudinaryPlayer} ${mapbox} ${aiGatewayRealtime}${toolbar("https://vercel.live", "wss://ws-us3.pusher.com")}`,
  `media-src 'self' blob: ${cloudinaryCdn}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `frame-src 'self' ${storageOrigin} ${turnstile}${toolbar("https://vercel.live")}`,
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
    value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/deepfilternet/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
