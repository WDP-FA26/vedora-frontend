import { POSTS_KEY } from "@/features/posts/posts-cache"

const FLUSH_INTERVAL_MS = 5_000
const MAX_BATCH = 50

const queued = new Set<string>()
const reported = new Set<string>()
let token: string | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let listening = false

function flush() {
  clearTimeout(timer)
  timer = undefined
  const postIds = [...queued]
  queued.clear()

  for (let start = 0; start < postIds.length; start += MAX_BATCH) {
    void fetch(`${POSTS_KEY}/views`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ postIds: postIds.slice(start, start + MAX_BATCH) }),
    }).catch(() => {})
  }
}

export function trackPostView(postId: string, accessToken: string | undefined) {
  if (reported.has(postId)) return
  reported.add(postId)
  queued.add(postId)
  token = accessToken

  if (!listening) {
    listening = true
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && queued.size > 0) flush()
    })
  }
  if (queued.size >= MAX_BATCH) flush()
  else timer ??= setTimeout(flush, FLUSH_INTERVAL_MS)
}
