import type { Metadata } from "next"

import { plainExcerpt } from "@/features/blogs/lib/plain-excerpt"
import type { ApiBlog } from "@/features/blogs/schemas"
import { postPath } from "@/features/posts/posts-cache"
import type { ApiPost } from "@/features/posts/schemas"
import { profilePath } from "@/features/profiles/profiles-cache"
import { absoluteUrl, SITE_LOCALE, SITE_NAME } from "@/lib/site"

export const FALLBACK_POST_TITLE = `Bài viết · ${SITE_NAME}`

const MAX_POST_TITLE = 60
const MAX_DESCRIPTION = 155

function clip(text: string, max: number) {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const cut = chars.slice(0, max - 1).join("")
  const space = cut.lastIndexOf(" ")
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function describe(post: ApiPost) {
  const author = post.author.fullName
  if (post.blog) {
    const excerpt = plainExcerpt(post.blog.excerpt)
    return {
      headline: post.blog.title,
      description: excerpt ? clip(excerpt, MAX_DESCRIPTION) : `Blog của ${author} trên ${SITE_NAME}.`,
    }
  }
  const body = (post.body ?? "").replace(/\s+/g, " ").trim()
  return {
    headline: body ? clip(body, MAX_POST_TITLE) : `Bài viết của ${author}`,
    description: body ? clip(body, MAX_DESCRIPTION) : `Bài viết của ${author} trên ${SITE_NAME}.`,
  }
}

function previewImage(post: ApiPost) {
  return post.blog?.coverImageUrl ?? post.media.find((media) => media.posterUrl)?.posterUrl ?? null
}

export function postMetadata(post: ApiPost): Metadata {
  const { headline, description } = describe(post)
  const image = previewImage(post)
  const url = postPath(post.id)
  return {
    title: `${headline} · ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url,
      title: headline,
      description,
      images: image ? [image] : undefined,
      publishedTime: post.publishedAt ?? undefined,
      authors: [absoluteUrl(profilePath(post.author.id))],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: headline,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export function blogJsonLd(post: ApiPost, article: ApiBlog | null) {
  if (!post.blog || post.status !== "PUBLISHED") return null
  const { headline, description } = describe(post)
  const image = previewImage(post)
  const url = absoluteUrl(postPath(post.id))
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    url,
    mainEntityOfPage: url,
    image: image ? [image] : undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: article?.updatedAt ?? post.publishedAt ?? undefined,
    inLanguage: "vi",
    author: {
      "@type": "Person",
      name: post.author.fullName,
      url: absoluteUrl(profilePath(post.author.id)),
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
  }
}
