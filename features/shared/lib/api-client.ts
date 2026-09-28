import { z } from "zod"

// Client Components call vedora-api directly with the token from `useAuth()`.

/** Nest error body; `code` is set on errors the UI handles specifically. */
const apiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]),
})

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Machine-readable reason, e.g. `UPLOAD_LIMIT_REACHED`. */
    readonly code: string | undefined,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function send(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  if (init.body) headers.set("Content-Type", "application/json")

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(await response.json().catch(() => null))
    throw new ApiError(
      response.status,
      error.data?.code,
      error.success ? [error.data.message].flat().join("; ") : response.statusText
    )
  }
  return response
}

export async function sendJson<S extends z.ZodType>(
  schema: S,
  url: string,
  token: string,
  init?: RequestInit
): Promise<z.infer<S>> {
  const response = await send(url, token, init)
  return schema.parse(await response.json())
}
