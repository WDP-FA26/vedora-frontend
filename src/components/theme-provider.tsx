"use client"

import { ThemeProvider as WrkszThemeProvider } from "@wrksz/themes/next"
import type { ThemeProviderProps } from "@wrksz/themes/next"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <WrkszThemeProvider {...props}>{children}</WrkszThemeProvider>
}
