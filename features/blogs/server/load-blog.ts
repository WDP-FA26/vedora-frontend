import "server-only"

import { notFound } from "next/navigation"

import { apiFetch } from "@/features/auth/lib/api"
import { getAccessToken } from "@/features/auth/server/session"
import { apiBlogSchema, type ApiBlog } from "@/features/blogs/schemas"

/** The signed-in author's blog for the editor; 404s for anyone else's. */
export async function loadBlogForEditing(id: string): Promise<ApiBlog> {
  const response = await apiFetch(`/blogs/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  })
  // Someone else's draft answers 404 as well; a malformed id answers 400.
  if (response.status === 404 || response.status === 400) notFound()
  if (!response.ok) throw new Error(`GET /blogs/${id} failed (${response.status})`)
  return apiBlogSchema.parse(await response.json())
}
