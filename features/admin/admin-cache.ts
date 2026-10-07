import { API_URL } from "@/features/auth/lib/api"

/** SWR key for the admin user list: `[url, accessToken]`, fetched with `fetchAllUsers`. */
export const ADMIN_USERS_KEY = `${API_URL}/users`
