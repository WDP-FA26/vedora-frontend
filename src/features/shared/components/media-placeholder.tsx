import type { LucideIcon } from "lucide-react"
import { ImageIcon } from "lucide-react"
import { cn } from "cn"


export type PlaceholderTone = "basil" | "tomato" | "grain" | "beet" | "sage"

export const toneClasses: Record<PlaceholderTone, string> = {
  basil:
    "bg-[oklch(0.9_0.05_150)] text-[oklch(0.4_0.08_150)] dark:bg-[oklch(0.3_0.045_150)] dark:text-[oklch(0.85_0.07_150)]",
  sage: "bg-[oklch(0.92_0.025_175)] text-[oklch(0.42_0.05_175)] dark:bg-[oklch(0.3_0.025_175)] dark:text-[oklch(0.86_0.04_175)]",
  tomato:
    "bg-[oklch(0.91_0.045_35)] text-[oklch(0.45_0.1_35)] dark:bg-[oklch(0.31_0.05_35)] dark:text-[oklch(0.86_0.07_35)]",
  grain:
    "bg-[oklch(0.93_0.045_85)] text-[oklch(0.45_0.07_75)] dark:bg-[oklch(0.32_0.04_80)] dark:text-[oklch(0.88_0.06_85)]",
  beet: "bg-[oklch(0.9_0.04_350)] text-[oklch(0.42_0.09_350)] dark:bg-[oklch(0.3_0.045_350)] dark:text-[oklch(0.86_0.06_350)]",
}

/**
 * Stand-in for real photography until uploads exist. Carries the alt text
 * so the layout and accessibility tree match the final image.
 */
export function MediaPlaceholder({
  tone,
  label,
  icon: Icon = ImageIcon,
  className,
  children,
}: {
  tone: PlaceholderTone
  label: string
  icon?: LucideIcon
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden",
        "bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,currentColor_14%,transparent)_1px,transparent_0)] bg-size-[14px_14px]",
        toneClasses[tone],
        className
      )}
    >
      <Icon aria-hidden className="size-7 opacity-50" strokeWidth={1.5} />
      {children}
    </div>
  )
}
