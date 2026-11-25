import { getAccessToken } from "@/features/auth/server/session"
import { API_URL } from "@/features/auth/lib/api"
import { VOICE_QUOTA_STATUS, voiceSessionSchema } from "@/features/meal-plan/voice"
import { ApiError, sendJson } from "@/features/shared/lib/api-client"

/**
 * Setup endpoint for the meal planner voice agent. `experimental_useRealtime` POSTs here
 * with the browser's cookies but no Authorization header, so this route forwards the
 * session's access token to vedora-api, which mints a short-lived AI Gateway token.
 * The response is the hook's setup shape: `{ token, url, expiresAt? }`.
 */
export async function POST(request: Request) {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return Response.json({ message: "Authentication required" }, { status: 401 })
  }

  const threadId = new URL(request.url).searchParams.get("threadId")
  const body = threadId ? JSON.stringify({ threadId }) : undefined

  try {
    const session = await sendJson(voiceSessionSchema, `${API_URL}/meal-plan/voice/session`, accessToken, {
      method: "POST",
      cache: "no-store",
      ...(body ? { body } : {}),
    })
    return Response.json({
      token: session.token,
      url: session.url,
      ...(session.expiresAt === null ? {} : { expiresAt: session.expiresAt }),
    })
  } catch (error) {
    // A route handler answers with a Response; anything but an API refusal stays a 500.
    if (!(error instanceof ApiError)) throw error
    return Response.json({ code: error.code, message: error.message }, { status: sessionErrorStatus(error) })
  }
}

/** The hook only reports the status, so a used-up AI allowance gets its own one. */
function sessionErrorStatus(error: ApiError) {
  if (error.code === "AI_QUOTA_EXCEEDED") return VOICE_QUOTA_STATUS
  return error.status
}
