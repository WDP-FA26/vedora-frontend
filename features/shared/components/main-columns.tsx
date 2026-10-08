"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/** Pages that take the right rail's space for a panel of their own. */
const WIDE_PATHS = ["/home/meal-planner"]

export function MainColumns({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  const wide = WIDE_PATHS.includes(usePathname())
  return (
    <>
      <main
        className={cn(
          "min-h-dvh w-full min-w-0 bg-background sm:border-x sm:border-border",
          !wide && "max-w-[37.5rem] xl:max-w-[42rem]"
        )}
      >
        {children}
      </main>
      {!wide && rail}
    </>
  )
}
