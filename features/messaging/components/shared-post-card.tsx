"use client"

import Link from "next/link"
import Image from "next/image"
import { BookOpenTextIcon, FileTextIcon } from "lucide-react"
import { postPath } from "@/features/posts/posts-cache"
import type { DirectMessage } from "../schemas"

export function SharedPostCard({ message }: { message: DirectMessage }) {
  if (!message.sharedPostId) return null
  const post = message.sharedPost
  if (!post)
    return (
      <div className="max-w-[85%] rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Bài viết không còn khả dụng.
      </div>
    )
  const Icon = post.type === "BLOG" ? BookOpenTextIcon : FileTextIcon
  return (
    <Link
      href={postPath(post.id)}
      aria-label={`Mở bài viết được chia sẻ của ${post.author.fullName}`}
      className="block w-72 max-w-[85%] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
    >
      {post.imageUrl && (
        <div className="relative aspect-video">
          <Image
            src={post.imageUrl}
            alt=""
            fill
            sizes="288px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="space-y-1 px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden />
          {post.type === "BLOG" ? "Blog" : "Bài viết"}
        </p>
        <p className="text-sm font-semibold wrap-anywhere">{post.author.fullName}</p>
        {post.title && (
          <p className="line-clamp-2 text-sm font-medium wrap-anywhere">{post.title}</p>
        )}
        {post.excerpt && (
          <p className="line-clamp-3 text-sm text-muted-foreground wrap-anywhere">{post.excerpt}</p>
        )}
      </div>
    </Link>
  )
}
