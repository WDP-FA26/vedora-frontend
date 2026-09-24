import Link from "next/link"
import { SproutIcon } from "lucide-react"
import { cn } from "cn"

/** Text wordmark, or just the round mark when `compact`. */
export function Wordmark({
  href = "/home",
  compact,
  className,
}: {
  href?: string
  compact?: boolean
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-label="Trang chủ Vedora"
      className={cn(
        "group/wordmark flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      {compact ? (
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover/wordmark:-rotate-6"
        >
          <SproutIcon className="size-5" strokeWidth={2} />
        </span>
      ) : (
        <span className="text-[2rem] leading-none font-extrabold tracking-[-0.04em]">
          Vedora
        </span>
      )}
    </Link>
  )
}
