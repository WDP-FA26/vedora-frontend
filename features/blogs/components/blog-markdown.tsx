"use client"

import { defaultRehypePlugins, Streamdown, type UrlTransform } from "streamdown"

import { cn } from "@/lib/utils"

// Blog content is the author's Markdown source. Raw HTML in it is dropped,
// not rendered: `skipHtml` removes it, and the `raw` plugin that would parse
// it is left out. Sanitize and harden still run on what Markdown produces.
const rehypePlugins = Object.entries(defaultRehypePlugins)
  .filter(([name]) => name !== "raw")
  .map(([, plugin]) => plugin)

const LINK_PROTOCOLS = ["https:", "http:", "mailto:"]

/**
 * Links may use http(s) or mailto, images https only. Anything else, such as
 * `javascript:` or `data:`, is dropped. Relative links stay on this site.
 */
export const safeUrl: UrlTransform = (url, key) => {
  const value = url.trim()
  if (key === "href" && (value.startsWith("#") || /^\/(?!\/)/.test(value))) return value
  try {
    const { protocol } = new URL(value)
    if (key === "src") return protocol === "https:" ? value : null
    return LINK_PROTOCOLS.includes(protocol) ? value : null
  } catch {
    return null
  }
}

/** A blog's Markdown, rendered as an article. */
export function BlogMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <Streamdown
      mode="static"
      skipHtml
      rehypePlugins={rehypePlugins}
      urlTransform={safeUrl}
      controls={false}
      className={cn("text-[1.0625rem] leading-relaxed break-words", className)}
    >
      {content}
    </Streamdown>
  )
}
