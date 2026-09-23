"use client"

import { BadgeCheckIcon } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function VerifiedBadge({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="inline-flex shrink-0 text-primary outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ring/50"
        tabIndex={0}
        aria-label={label}
      >
        <BadgeCheckIcon
          aria-hidden
          className="size-4 fill-primary stroke-card"
          strokeWidth={2}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
