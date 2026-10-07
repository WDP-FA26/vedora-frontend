import { ADMIN_REPORTS_KEY, adminPostKey } from "@/features/admin/admin-cache"
import { parseVtt } from "@/features/admin/lib/vtt"
import {
  adminPostDetailSchema,
  adminPostPageSchema,
  adminReportPageSchema,
  adminReportSchema,
  adminUserPageSchema,
  type AdminPost,
  type AdminReport,
  type AdminUser,
} from "@/features/admin/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

/** The API's `MAX_PAGE_LIMIT`. */
const PAGE_LIMIT = 50

/**
 * Every user, newest first. `GET /users` only pages, so the table sorts,
 * filters and paginates in the browser and needs the whole list.
 */
export async function fetchAllUsers([url, token]: readonly [string, string]) {
  const users: AdminUser[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      adminUserPageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    users.push(...items)
    if (!meta.hasNextPage) return users
  }
}

/** Every post, newest first; the table needs the whole list, like `fetchAllUsers`. */
export async function fetchAllPosts([url, token]: readonly [string, string]) {
  const posts: AdminPost[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      adminPostPageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    posts.push(...items)
    if (!meta.hasNextPage) return posts
  }
}

export function fetchAdminPost([url, token]: readonly [string, string]) {
  return sendJson(adminPostDetailSchema, url, token)
}

export async function deleteAdminPost(token: string, id: string) {
  await send(adminPostKey(id), token, { method: "DELETE" })
}

/** A caption track's cues, read from its public WebVTT file on Mux. */
export async function fetchTranscript(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Transcript request failed: ${response.status}`)
  return parseVtt(await response.text())
}

/** Every report, newest first; the table needs the whole list, like `fetchAllUsers`. */
export async function fetchAllReports([url, token]: readonly [string, string]) {
  const reports: AdminReport[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      adminReportPageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    reports.push(...items)
    if (!meta.hasNextPage) return reports
  }
}

export function reviewReport(token: string, id: string, status: "RESOLVED" | "DISMISSED") {
  return sendJson(adminReportSchema, `${ADMIN_REPORTS_KEY}/${id}/review`, token, {
    method: "POST",
    body: JSON.stringify({ status }),
  })
}
