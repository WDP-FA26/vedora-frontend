import "server-only"

import { notFound } from "next/navigation"

import { apiFetch } from "@/features/auth/lib/api"
import { getAccessToken } from "@/features/auth/server/session"
import { apiBlogSchema, type ApiBlog } from "@/features/blogs/schemas"

export async function loadBlogForEditing(id: string): Promise<ApiBlog> {
  const response = await apiFetch(`/blogs/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  })
  if (response.status === 404 || response.status === 400) notFound()
  if (!response.ok) throw new Error(`GET /blogs/${id} failed (${response.status})`)
  return apiBlogSchema.parse(await response.json())
}
