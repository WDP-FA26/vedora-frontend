import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR key prefix for the signed-in user: `useAuth()` fetches
 * `[AUTH_KEY, accessToken]` straight from the API, `AuthProvider` seeds it
 * with the server's `getAuth()` result, and sign-in clears it.
 */
export const AUTH_KEY = `${API_URL}/auth/me`
