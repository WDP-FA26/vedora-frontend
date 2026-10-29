import type { Metadata } from "next"

import { plainExcerpt } from "@/features/blogs/lib/plain-excerpt"
import type { ApiPost } from "@/features/posts/schemas"

const SITE = "Vedora"
/** Title for a post that cannot be read: missing, a draft, or the API is down. */
export const FALLBACK_POST_TITLE = `Bài viết · ${SITE}`

/** Search results show about 60 characters of a title and 155 of a description. */
const MAX_POST_TITLE = 60
const MAX_DESCRIPTION = 155

/** `text` cut to `max` characters at a word boundary, with an ellipsis when cut. */
function clip(text: string, max: number) {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const cut = chars.slice(0, max - 1).join("")
  const space = cut.lastIndexOf(" ")
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * `<title>` and description for a post's page. A blog is titled by its own
 * title, which is shown whole; a short post by the start of its text, or by
 * its author when it has none.
 */
export function postMetadata(post: ApiPost): Metadata {
  const author = post.author.fullName
  if (post.blog) {
    const excerpt = plainExcerpt(post.blog.excerpt)
    return {
      title: `${post.blog.title} · ${SITE}`,
      description: excerpt ? clip(excerpt, MAX_DESCRIPTION) : `Blog của ${author} trên ${SITE}.`,
    }
  }
  const body = (post.body ?? "").replace(/\s+/g, " ").trim()
  return {
    title: body ? `${clip(body, MAX_POST_TITLE)} · ${SITE}` : `Bài viết của ${author} · ${SITE}`,
    description: body ? clip(body, MAX_DESCRIPTION) : `Bài viết của ${author} trên ${SITE}.`,
  }
}
