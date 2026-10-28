import { z } from "zod"

// Client Components call vedora-api directly with the token from `useAuth()`.
// Public endpoints are called without one when the visitor is signed out.

/**
 * The API error body: `{ statusCode, code, message, details? }`. `code` is a
 * machine-readable reason the UI can branch on; `details` carries code-specific
 * fields, such as `email` on EMAIL_NOT_VERIFIED. A proxy or framework error may
 * omit them, so every field stays optional here.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().optional(),
  code: z.string().optional(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Machine-readable reason, e.g. `UPLOAD_LIMIT_REACHED`. */
    readonly code: string | undefined,
    message: string,
    readonly details: Record<string, unknown> | undefined
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function send(url: string, token: string | undefined, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body) headers.set("Content-Type", "application/json")

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(await response.json().catch(() => null))
    if (!error.success) throw new ApiError(response.status, undefined, response.statusText, undefined)
    throw new ApiError(response.status, error.data.code, error.data.message, error.data.details)
  }
  return response
}

export async function sendJson<S extends z.ZodType>(
  schema: S,
  url: string,
  token: string | undefined,
  init?: RequestInit
): Promise<z.infer<S>> {
  const response = await send(url, token, init)
  return schema.parse(await response.json())
}
