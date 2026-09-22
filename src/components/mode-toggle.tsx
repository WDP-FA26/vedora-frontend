"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@wrksz/themes/client"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onPress={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="scale-100 dark:scale-0" />
      <Moon className="absolute scale-0 dark:scale-100" />
    </Button>
  )
}
