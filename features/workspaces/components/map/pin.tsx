import { MapPinIcon } from "lucide-react"
import { cn } from "cn"

export function Pin({ className }: { className?: string }) {
  return (
    <MapPinIcon
      aria-hidden
      className={cn("size-9 fill-primary stroke-primary-foreground drop-shadow-md", className)}
      strokeWidth={1.5}
    />
  )
}
