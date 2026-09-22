"use client"

import { ThemeProvider as NextThemesProvider } from "@teispace/next-themes"
import type { ThemeProviderProps } from "@teispace/next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
