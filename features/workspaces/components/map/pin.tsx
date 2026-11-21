import { MapPinIcon } from "lucide-react"
import { cn } from "cn"

/** The map marker for a restaurant: a forest-green pin. */
export function Pin({ className }: { className?: string }) {
  return (
    <MapPinIcon
      aria-hidden
      className={cn("size-9 fill-primary stroke-primary-foreground drop-shadow-md", className)}
      strokeWidth={1.5}
    />
  )
}
