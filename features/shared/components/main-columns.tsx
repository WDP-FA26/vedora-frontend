"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const WIDE_PATHS = ["/home/meal-planner", "/home/messages", "/home/restaurants"]

export function MainColumns({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  const pathname = usePathname()
  const wide = WIDE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  return (
    <>
      <main
        data-wide={wide}
        className={cn(
          "min-h-dvh w-full min-w-0 bg-background sm:border-x sm:border-border",
          !wide && "max-w-[37.5rem] xl:max-w-[42rem]"
        )}
      >
        {children}
      </main>
      <div className={wide ? "hidden" : "contents"}>{rail}</div>
    </>
  )
}
