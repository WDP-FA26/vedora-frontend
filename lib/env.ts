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

export const PUBLIC_ENV = {
  apiUrl: data.NEXT_PUBLIC_API_URL,
  storageUrl: data.NEXT_PUBLIC_STORAGE_URL,
  cloudinaryCloudName: data.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  turnstileSiteKey: data.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TURNSTILE_TEST_SITE_KEY,
}
