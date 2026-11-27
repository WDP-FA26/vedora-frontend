import { z } from "zod"
import { notifyApiMutation } from "./api-events"

export const apiErrorSchema = z.object({
  statusCode: z.number().optional(),
  code: z.string().optional(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export class ApiError extends Error {
  constructor(
    readonly status: number,
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
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json")

  const response = await fetch(url, { ...init, headers })
  notifyApiMutation(init.method)
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(await response.json().catch(() => null))
    if (!error.success)
      throw new ApiError(response.status, undefined, response.statusText, undefined)
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
