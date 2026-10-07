import { adminUserPageSchema, type AdminUser } from "@/features/admin/schemas"
import { sendJson } from "@/features/shared/lib/api-client"

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
