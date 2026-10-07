import { POSTS_KEY } from "@/features/posts/posts-cache"

// Views are queued here and sent to `POST /posts/views` in batches, so a
// scrolling feed costs one small request every few seconds rather than one
// per post. The API dedupes and counts them.

const FLUSH_INTERVAL_MS = 5_000
/** The API's `MAX_VIEW_BATCH`. */
const MAX_BATCH = 50

const queued = new Set<string>()
/** Posts already reported from this page load. */
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
    // `keepalive` lets the last batch leave while the page is closing. Losing
    // a batch only costs a few views, so failures are ignored.
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

/** Queues one view of `postId`; a post is reported once per page load. */
export function trackPostView(postId: string, accessToken: string | undefined) {
  if (reported.has(postId)) return
  reported.add(postId)
  queued.add(postId)
  token = accessToken

  if (!listening) {
    listening = true
    // Mobile browsers fire this, not `unload`, when the tab is left.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && queued.size > 0) flush()
    })
  }
  if (queued.size >= MAX_BATCH) flush()
  else timer ??= setTimeout(flush, FLUSH_INTERVAL_MS)
}
