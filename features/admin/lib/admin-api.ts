import {
  ADMIN_REPORTS_KEY,
  ADMIN_USERS_KEY,
  adminPostKey,
  MODERATION_SETTINGS_KEY,
} from "@/features/admin/admin-cache"
import { parseVtt } from "@/features/admin/lib/vtt"
import {
  adminPostDetailSchema,
  adminPostPageSchema,
  adminReportPageSchema,
  adminReportSchema,
  adminUserPageSchema,
  adminUserSchema,
  moderationSettingsSchema,
  moderationTestResultSchema,
  type ModerationPolicyDraft,
  type AdminPost,
  type AdminReport,
  type AdminUser,
} from "@/features/admin/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

/** The API's `MAX_PAGE_LIMIT`. */
const PAGE_LIMIT = 50

/**
 * Every user matching `url`'s `q`/`status` (see `adminUsersKey`), newest
 * first. The API filters; the table sorts and paginates in the browser, so it
 * needs every matching row.
 */
export async function fetchAllUsers([url, token]: readonly [string, string]) {
  const users: AdminUser[] = []
  for (let page = 1; ; page++) {
    const pageUrl = new URL(url)
    pageUrl.searchParams.set("page", String(page))
    pageUrl.searchParams.set("limit", String(PAGE_LIMIT))
    const { items, meta } = await sendJson(adminUserPageSchema, pageUrl.toString(), token)
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

/** Approves or rejects a post held for review, or overturns a rejection. */
export function moderateAdminPost(
  token: string,
  id: string,
  decision: "APPROVE" | "REJECT",
  note: string
) {
  return sendJson(adminPostDetailSchema, `${adminPostKey(id)}/moderation`, token, {
    method: "POST",
    body: JSON.stringify(note ? { decision, note } : { decision }),
  })
}

export async function deleteAdminPost(token: string, id: string) {
  await send(adminPostKey(id), token, { method: "DELETE" })
}

/** A caption track's cues, read from its public WebVTT file on Cloudinary. */
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

/** What every role or status change carries, recorded in the API's audit log. */
type AccountOperation = {
  reason: string
  /** The target's `accountVersion` when the admin read it. */
  expectedVersion: number
}

export type AccountStatusChange = AccountOperation & { status: "ACTIVE" | "SUSPENDED" }
export type AccountRoleChange = AccountOperation & { role: AdminUser["role"] }

/** Suspends or reactivates an account; the API refuses a stale version. Returns the account. */
export function updateUserStatus(token: string, id: string, change: AccountStatusChange) {
  return sendJson(adminUserSchema, `${ADMIN_USERS_KEY}/${id}/status`, token, {
    method: "PATCH",
    body: JSON.stringify(change),
  })
}

/** Grants or removes admin rights; the API refuses a stale version. Returns the account. */
export function updateUserRole(token: string, id: string, change: AccountRoleChange) {
  return sendJson(adminUserSchema, `${ADMIN_USERS_KEY}/${id}/role`, token, {
    method: "PATCH",
    body: JSON.stringify(change),
  })
}

export function reviewReport(token: string, id: string, status: "RESOLVED" | "DISMISSED") {
  return sendJson(adminReportSchema, `${ADMIN_REPORTS_KEY}/${id}/review`, token, {
    method: "POST",
    body: JSON.stringify({ status }),
  })
}

export function fetchModerationSettings([url, token]: readonly [string, string]) {
  return sendJson(moderationSettingsSchema, url, token)
}

/** Replaces the policy; `version` is the one that was loaded, so a stale save answers 409. */
export function saveModerationSettings(token: string, draft: ModerationPolicyDraft, version: number) {
  return sendJson(moderationSettingsSchema, MODERATION_SETTINGS_KEY, token, {
    method: "PUT",
    body: JSON.stringify({ ...draft, version }),
  })
}

export function resetModerationSettings(token: string) {
  return sendJson(moderationSettingsSchema, `${MODERATION_SETTINGS_KEY}/reset`, token, {
    method: "POST",
  })
}

/** Tries a text against a draft policy without saving it. */
export function testModeration(token: string, text: string, draft: ModerationPolicyDraft) {
  return sendJson(moderationTestResultSchema, `${MODERATION_SETTINGS_KEY}/test`, token, {
    method: "POST",
    body: JSON.stringify({ text, settings: draft }),
  })
}
