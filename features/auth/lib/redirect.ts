const DEFAULT_SIGNED_IN_PATH = "/home"

// Stand-in origin: only whether `next` stays on it matters.
const BASE = "https://vedora.invalid"

/**
 * Only same-origin paths, so `?next=` can't be used as an open redirect.
 * `next` is resolved the way a browser would resolve it. That catches
 * `//evil.com`, `/\evil.com` and `/<tab>/evil.com` (URL parsing drops tabs and
 * newlines, turning it into `//evil.com`).
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next?.startsWith("/")) return DEFAULT_SIGNED_IN_PATH
  try {
    const url = new URL(next, BASE)
    if (url.origin !== BASE) return DEFAULT_SIGNED_IN_PATH
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_SIGNED_IN_PATH
  }
}
