import { getAccessToken } from "@/features/auth/server/session"
import { apiFetch } from "@/features/auth/lib/api"
import { voiceSessionSchema } from "@/features/meal-plan/voice"

/**
 * Setup endpoint for the meal planner voice agent. `experimental_useRealtime` POSTs here
 * with the browser's cookies but no Authorization header, so this route forwards the
 * session's access token to vedora-api, which mints a short-lived AI Gateway token.
 * The response is the hook's setup shape: `{ token, url, expiresAt? }`.
 */
export async function POST() {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return Response.json({ message: "Authentication required" }, { status: 401 })
  }

  const response = await apiFetch("/meal-plan/voice/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    })
  }

  const session = voiceSessionSchema.parse(await response.json())
  return Response.json({
    token: session.token,
    url: session.url,
    ...(session.expiresAt === null ? {} : { expiresAt: session.expiresAt }),
  })
}
