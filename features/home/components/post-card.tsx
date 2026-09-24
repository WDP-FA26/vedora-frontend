"use client"

import { useState } from "react"
import {
  BookmarkIcon,
  ChartNoAxesColumnIcon,
  CheckIcon,
  ClapperboardIcon,
  EllipsisIcon,
  EyeOffIcon,
  FileTextIcon,
  FlagIcon,
  LinkIcon,
  MessageCircleIcon,
  PlayIcon,
  Repeat2Icon,
  ShareIcon,
  SproutIcon,
  TimerIcon,
  VolumeXIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { formatCount, formatPostDate, formatPostDateLong } from "@/features/shared/lib/format"
import { MediaPlaceholder } from "@/features/shared/components/media-placeholder"
import type { ArticlePost, PhotoPost, Post, VideoPost } from "@/features/home/types"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { PostVideo } from "@/features/posts/components/post-video"

export function PostCard({ post }: { post: Post }) {
  return (
    <article
      aria-label={`Bài viết của ${post.author.name}`}
      className="flex gap-3 border-b border-border px-4 pt-6 pb-4 transition-colors hover:bg-[color-mix(in_oklch,var(--card),var(--muted)_45%)]"
    >
      <AuthorAvatar author={post.author} size="lg" className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1 text-[0.9375rem] leading-5">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-bold">{post.author.name}</span>
            {post.author.verified && (
              <VerifiedBadge label={post.author.verified} />
            )}
          </span>
          <span className="min-w-0 truncate text-muted-foreground">
            @{post.author.handle}
          </span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <time
            dateTime={post.publishedAt}
            title={formatPostDateLong(post.publishedAt)}
            className="shrink-0 text-muted-foreground tabular-nums"
          >
            {formatPostDate(post.publishedAt)}
          </time>
          <PostMenu post={post} />
        </header>

        <p className="mt-1.5 text-[0.9375rem] leading-[1.4] text-pretty whitespace-pre-line">
          {post.body}{" "}
          {post.tags.map((tag) => (
            <a key={tag} href="#" className="mr-1 text-primary hover:underline">
              #{tag}
            </a>
          ))}
        </p>

        {post.kind === "video" && <VideoMedia post={post} />}
        {post.kind === "article" && <ArticleCard post={post} />}
        {post.kind === "photo" && <PhotoMedia post={post} />}

        <PostActions post={post} />
      </div>
    </article>
  )
}

function VideoMedia({ post }: { post: VideoPost }) {
  const { video, author } = post
  if (video.source === "mux") {
    return <PostVideo postId={post.id} author={author} video={video} />
  }
  return (
    <MediaPlaceholder
      tone={video.tone}
      label={`${video.caption} của ${author.name}`}
      icon={ClapperboardIcon}
      className="mt-4 aspect-video rounded-2xl border border-border"
    >
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.08)]">
        <ClapperboardIcon aria-hidden className="size-3.5 text-primary" />
        {video.caption}
      </span>
      <Button
        aria-label={`Phát video, ${video.duration}`}
        variant="raised"
        size="icon-fab"
        shape="pill"
        className="absolute top-1/2 left-1/2 -translate-1/2"
      >
        <PlayIcon aria-hidden className="translate-x-px fill-current" />
      </Button>
      <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
        <TimerIcon aria-hidden className="size-3.5" />
        {video.duration}
      </span>
    </MediaPlaceholder>
  )
}

/** X-style large link card: cover on top, title and source below. */
function ArticleCard({ post }: { post: ArticlePost }) {
  return (
    <a
      href="#"
      className="group/card mt-4 block overflow-hidden rounded-2xl border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <MediaPlaceholder
        tone={post.attachment.tone}
        label="Ảnh bìa bài nghiên cứu"
        icon={FileTextIcon}
        className="aspect-[1.91/1]"
      />
      <span className="block border-t border-border px-3 py-2.5 transition-colors group-hover/card:bg-muted/60">
        <span className="block text-[0.9375rem] leading-snug font-semibold">
          {post.attachment.title}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {post.attachment.source}
        </span>
      </span>
    </a>
  )
}

function PhotoMedia({ post }: { post: PhotoPost }) {
  const single = post.photos.length === 1
  return (
    <div
      className={cn(
        "mt-4 grid gap-0.5 overflow-hidden rounded-2xl border border-border",
        single ? "grid-cols-1" : "grid-cols-2"
      )}
    >
      {post.photos.map((photo) => (
        <MediaPlaceholder
          key={photo.alt}
          tone={photo.tone}
          label={photo.alt}
          className={single ? "aspect-[16/10]" : "aspect-[4/5]"}
        />
      ))}
    </div>
  )
}

function PostMenu({ post }: { post: Post }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="action"
            size="icon-sm"
            shape="pill"
            className="-my-1 -mr-2 ml-auto"
          />
        }
        aria-label="Tùy chọn khác"
      >
        <EllipsisIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem>
          <LinkIcon aria-hidden />
          Sao chép liên kết
        </DropdownMenuItem>
        <DropdownMenuItem>
          <EyeOffIcon aria-hidden />
          Không quan tâm bài viết này
        </DropdownMenuItem>
        <DropdownMenuItem>
          <VolumeXIcon aria-hidden />
          Tắt tiếng @{post.author.handle}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <FlagIcon aria-hidden />
          Báo cáo bài viết
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PostActions({ post }: { post: Post }) {
  const [sprouted, setSprouted] = useState(post.sprouted ?? false)
  const [reposted, setReposted] = useState(false)
  const [bookmarked, setBookmarked] = useState(post.bookmarked ?? false)
  const [copied, setCopied] = useState(false)

  const sprouts =
    post.stats.sprouts + Number(sprouted) - Number(post.sprouted ?? false)
  const reposts = post.stats.reposts + (reposted ? 1 : 0)

  async function share() {
    const url = `${window.location.origin}/posts/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be blocked (insecure context, denied permission); the
      // button simply stays in its resting state.
    }
  }

  return (
    <div
      role="group"
      aria-label="Hành động với bài viết"
      className="mt-3 -ml-2.5 flex items-center justify-between gap-1"
    >
      <ActionButton label="Trả lời" count={post.stats.replies} icon={MessageCircleIcon} />
      <ActionButton
        label={reposted ? "Hủy đăng lại" : "Đăng lại"}
        count={reposts}
        icon={Repeat2Icon}
        active={reposted}
        toggle
        onClick={() => setReposted((value) => !value)}
      />
      <ActionButton
        label={sprouted ? "Bỏ thả mầm" : "Thả mầm"}
        count={sprouts}
        icon={SproutIcon}
        active={sprouted}
        toggle
        onClick={() => setSprouted((value) => !value)}
        activeIconClassName="animate-sprout-pop fill-primary/25"
      />
      <ActionButton
        label="Lượt xem"
        count={post.stats.views}
        icon={ChartNoAxesColumnIcon}
      />
      <span className="flex items-center">
        <ActionButton
          label={bookmarked ? "Bỏ lưu" : "Lưu"}
          icon={BookmarkIcon}
          active={bookmarked}
          toggle
          onClick={() => setBookmarked((value) => !value)}
          activeIconClassName="fill-primary"
        />
        <ActionButton
          label={copied ? "Đã sao chép liên kết" : "Chia sẻ"}
          icon={copied ? CheckIcon : ShareIcon}
          active={copied}
          onClick={share}
        />
      </span>
    </div>
  )
}

function ActionButton({
  label,
  count,
  icon: Icon,
  active,
  toggle,
  onClick,
  activeIconClassName,
}: {
  label: string
  count?: number
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  active?: boolean
  /** Exposes `active` as a pressed state to assistive tech. */
  toggle?: boolean
  onClick?: () => void
  activeIconClassName?: string
}) {
  return (
    <Button
      variant="action"
      size="count"
      shape="pill"
      aria-label={count === undefined ? label : `${label}, ${formatCount(count)}`}
      aria-pressed={toggle ? Boolean(active) : undefined}
      data-active={active ? "" : undefined}
      onClick={onClick}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn(active && activeIconClassName)}
      />
      {count !== undefined && <span>{formatCount(count)}</span>}
    </Button>
  )
}
