import { z } from "zod"

import "./zod-config"

/**
 * Public build-time configuration. Next.js inlines `NEXT_PUBLIC_*` values into
 * the client bundle, so a missing value cannot be corrected once `next dev`,
 * `next build` or `next start` is running. Validate here, at startup, instead
 * of letting a page fail on its first request.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_STORAGE_URL: z.string().url(),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1),
  // Origin of this site, for absolute links in metadata, the sitemap and robots.txt.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  // Optional in development; a production build must ship a real site key.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
})

const isProduction = process.env.NODE_ENV === "production"

/** Cloudflare's always-pass site key, for local development. */
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA"

function fail(problems: string[]): never {
  throw new Error(
    `Frontend environment is not configured: ${problems.join("; ")}. ` +
      "Set the values in .env.local (see .env.example) or in the deployment environment.",
  )
}

function readPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STORAGE_URL: process.env.NEXT_PUBLIC_STORAGE_URL,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    // An empty value in .env.local means "not configured", not an empty key.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  })

  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const name = issue.path.length > 0 ? issue.path.join(".") : "environment"
      return `${name}: ${issue.message}`
    })
    fail(problems)
  }

  if (isProduction && !parsed.data.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    fail(["NEXT_PUBLIC_TURNSTILE_SITE_KEY: required in production"])
  }

  return parsed.data
}

const data = readPublicEnv()

/**
 * Vercel names the production domain at build time; elsewhere, without
 * NEXT_PUBLIC_SITE_URL, links point at the local dev server.
 */
function siteUrl() {
  if (data.NEXT_PUBLIC_SITE_URL) return data.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : "http://localhost:3000"
}

export const PUBLIC_ENV = {
  apiUrl: data.NEXT_PUBLIC_API_URL,
  storageUrl: data.NEXT_PUBLIC_STORAGE_URL,
  cloudinaryCloudName: data.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  siteUrl: siteUrl(),
  turnstileSiteKey: data.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TURNSTILE_TEST_SITE_KEY,
}
