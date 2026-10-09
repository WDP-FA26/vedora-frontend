"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon, CheckIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { suggestedCreators } from "@/features/shared/data/creators"
import type { Author } from "@/features/shared/types"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"

/**
 * Like X.com: the rail scrolls with the feed until its bottom reaches the
 * viewport bottom, then sticks there. A shorter rail simply sticks to the top.
 */
function useStickyTop() {
  const ref = useRef<HTMLElement>(null)
  const [top, setTop] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setTop(Math.min(0, window.innerHeight - element.offsetHeight))
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])

  return { ref, top }
}

export function RightRail() {
  const { ref, top } = useStickyTop()

  return (
    <aside
      ref={ref}
      aria-label="Khám phá thêm"
      style={{ top }}
      className="sticky hidden w-[21.875rem] shrink-0 flex-col gap-4 self-start py-3 pl-6 *:shrink-0 lg:flex xl:pl-8"
    >
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <InputGroup variant="search">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Tìm kiếm trên Vedora"
            placeholder="Tìm công thức, blog, nhà sáng tạo…"
          />
        </InputGroup>
      </form>

      <AiPanel />

      <UpgradePanel />

      <Panel title="Nhà sáng tạo nên theo dõi">
        <ul>
          {suggestedCreators.slice(0, 3).map((creator) => (
            <CreatorRow key={creator.handle} creator={creator} />
          ))}
        </ul>
        <PanelLink href="#">Khám phá thêm nhà sáng tạo</PanelLink>
      </Panel>

      <nav aria-label="Pháp lý" className="px-4 pb-4">
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {["Điều khoản", "Quyền riêng tư", "Tiêu chuẩn cộng đồng", "Trợ năng"].map((label) => (
            <li key={label}>
              <Link href="#" className="hover:underline">
                {label}
              </Link>
            </li>
          ))}
          <li>© 2026 Vedora</li>
        </ul>
      </nav>
    </aside>
  )
}

function AiPanel() {
  return (
    <Link
      href="/home/meal-planner"
      className="group relative block overflow-hidden rounded-2xl bg-brand-forest p-4 text-white outline-none transition hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="relative z-10 block max-w-[68%]">
        <span className="block text-base leading-snug font-bold">
          Thực đơn bữa ăn theo tuần
        </span>
        <span className="mt-1 block text-xs leading-5 text-white/75">
          Sắp xếp bữa sáng, trưa và tối trong tuần, đổi món cùng Trợ lý Vedora khi cần.
        </span>
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-lemon">
          Xem thực đơn tuần
          <ArrowRightIcon aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
      <span aria-hidden className="absolute right-1 bottom-1 size-24 rotate-3">
        <Image src="/carrot-sticker.png" alt="" width={256} height={256} className="h-full w-full object-contain drop-shadow-md" />
      </span>
    </Link>
  )
}

const upgradePerks = [
  "Trợ lý không giới hạn",
  "Thực đơn tuần tự động",
  "Video dài đến 30 phút",
]

function UpgradePanel() {
  return (
    <section
      aria-labelledby="upgrade-title"
      className="rounded-2xl border border-border bg-card px-4 py-4"
    >
      <h2
        id="upgrade-title"
        className="text-[1.0625rem] font-bold tracking-[-0.02em]"
      >
        Vedora Plus
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {upgradePerks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            {perk}
          </li>
        ))}
      </ul>
      <Button
        size="pill-sm"
        shape="pill"
        className="mt-4"
        render={<Link href="/home/upgrade" />}
        nativeButton={false}
      >
        Nâng cấp
      </Button>
    </section>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="px-4 pt-4 pb-2 text-[1.0625rem] font-bold tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-4 py-3 text-sm font-semibold text-primary transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted"
    >
      {children}
    </Link>
  )
}

function CreatorRow({ creator }: { creator: Author }) {
  const [following, setFollowing] = useState(false)

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <AuthorAvatar author={creator} size="lg" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm font-bold">{creator.name}</span>
          {creator.verified && <VerifiedBadge label={creator.verified} />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          @{creator.handle}
        </span>
      </span>
      <Button
        size="pill-sm"
        shape="pill"
        variant={following ? "outline" : "default"}
        aria-pressed={following}
        onClick={() => setFollowing((value) => !value)}
        className="min-w-[5.5rem]"
      >
        {following ? "Đang theo dõi" : "Theo dõi"}
        <span className="sr-only"> {creator.name}</span>
      </Button>
    </li>
  )
}
