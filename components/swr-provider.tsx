"use client"

import "@/lib/zod-config"
import { SWRConfig } from "swr"
import { fetcher } from "@/lib/fetcher"

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  )
}
