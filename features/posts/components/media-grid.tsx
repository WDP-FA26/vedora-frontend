import { Children } from "react"
import { cn } from "cn"

/**
 * X's attachment layout. One item keeps its own shape; two sit side by side,
 * three put the first in a tall left column, four make a 2×2 grid, all in a
 * 16:9 frame so every cell crops to fill.
 */
export function MediaGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const items = Children.toArray(children)

  if (items.length === 1) {
    return (
      <div className={cn("overflow-hidden rounded-2xl border border-border", className)}>
        {items}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid aspect-video grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-border",
        items.length > 2 && "grid-rows-2",
        className
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "relative min-h-0 min-w-0 overflow-hidden",
            items.length === 3 && index === 0 && "row-span-2"
          )}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
