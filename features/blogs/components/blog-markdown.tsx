"use client"

import { defaultRehypePlugins, Streamdown, type UrlTransform } from "streamdown"

import { cn } from "cn"

import { BlogGallery, type GalleryImage } from "@/features/blogs/components/blog-gallery"
import { isAllowedBlogMediaUrl } from "@/features/blogs/lib/media-upload"

const rehypePlugins = [
  ...Object.entries(defaultRehypePlugins)
    .filter(([name]) => name !== "raw")
    .map(([, plugin]) => plugin),
  rehypeNoReferrer,
  rehypeDemoteH1,
]

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] }

function rehypeNoReferrer() {
  const visit = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "img") {
      node.properties = { ...node.properties, referrerPolicy: "no-referrer" }
    }
    node.children?.forEach(visit)
  }
  return visit
}

function rehypeDemoteH1() {
  const visit = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "h1") node.tagName = "h2"
    node.children?.forEach(visit)
  }
  return visit
}

const LINK_PROTOCOLS = ["https:", "http:", "mailto:"]

export const safeUrl: UrlTransform = (url, key) => {
  const value = url.trim()
  if (key === "src") return safeImageSrc(value)
  if (value.startsWith("#") || /^\/(?!\/)/.test(value)) return value
  try {
    return LINK_PROTOCOLS.includes(new URL(value).protocol) ? value : null
  } catch {
    return null
  }
}

function safeImageSrc(url: string) {
  return isAllowedBlogMediaUrl(url) ? url : null
}

const IMAGE_LINE = /^\s*!\[([^\]]*)\]\((\S+?)\)\s*$/
const FENCE = /^\s*(```|~~~)/
const isVideo = (url: string) => /\/video\/upload\//.test(url) || /\.(mp4|webm|mov)(\?|#|$)/i.test(url)

type Segment = { kind: "markdown"; text: string } | { kind: "gallery"; images: GalleryImage[] }

function segment(content: string): Segment[] {
  const segments: Segment[] = []
  let text: string[] = []
  let run: { line: string; image: GalleryImage }[] = []
  let inFence = false

  const flushRun = () => {
    if (run.length >= 2) {
      if (text.length) segments.push({ kind: "markdown", text: text.join("\n") })
      text = []
      segments.push({ kind: "gallery", images: run.map(({ image }) => image) })
    } else {
      text.push(...run.map(({ line }) => line))
    }
    run = []
  }

  for (const line of content.split(/\r?\n/)) {
    if (FENCE.test(line)) inFence = !inFence
    const match = inFence ? null : IMAGE_LINE.exec(line)
    const src = match ? safeImageSrc(match[2]) : null
    if (match && src && !isVideo(src)) {
      run.push({ line, image: { src, alt: match[1] } })
    } else if (run.length && line.trim() === "") {
      continue
    } else {
      flushRun()
      text.push(line)
    }
  }
  flushRun()
  if (text.length) segments.push({ kind: "markdown", text: text.join("\n") })
  return segments
}

function Markdown({ text }: { text: string }) {
  return (
    <Streamdown mode="static" skipHtml rehypePlugins={rehypePlugins} urlTransform={safeUrl} controls={false}>
      {text}
    </Streamdown>
  )
}

export function BlogMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("text-[1.0625rem] leading-relaxed break-words", className)}>
      {segment(content).map((part, index) =>
        part.kind === "gallery" ? (
          <BlogGallery key={index} images={part.images} />
        ) : (
          <Markdown key={index} text={part.text} />
        )
      )}
    </div>
  )
}
