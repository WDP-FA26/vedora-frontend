import Link from "next/link"
import { cn } from "cn"

/**
 * The Vedora logo (`public/logo.svg`). `mono` paints its silhouette in the
 * current text color, for colored backgrounds; dark mode always does.
 */
export function Logo({ mono, className }: { mono?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block aspect-[2.8] h-10 shrink-0",
        mono
          ? "bg-current mask-[url(/logo.svg)] mask-contain mask-center mask-no-repeat"
          : "bg-[url(/logo.svg)] bg-contain bg-center bg-no-repeat dark:bg-current dark:bg-none dark:mask-[url(/logo.svg)] dark:mask-contain dark:mask-center dark:mask-no-repeat",
        className
      )}
    />
  )
}

/** The round “V” mark (`public/logo-mark.svg`) on a primary disc. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground",
        className
      )}
    >
      <span className="size-3/5 bg-current mask-[url(/logo-mark.svg)] mask-contain mask-center mask-no-repeat" />
    </span>
  )
}

/** The logo, or just the round “V” mark (`public/logo-mark.svg`) when `compact`. */
export function Wordmark({
  href = "/home",
  compact,
  mono,
  className,
}: {
  href?: string
  compact?: boolean
  mono?: boolean
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
        <LogoMark className="transition-transform group-hover/wordmark:-rotate-6" />
      ) : (
        <Logo mono={mono} />
      )}
    </Link>
  )
}
