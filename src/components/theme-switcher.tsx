"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import {
  useHydrated,
  useTheme,
  type ThemeSelection,
} from "@wrksz/themes/client"

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const themes = [
  { value: "light", label: "Sáng", icon: SunIcon },
  { value: "dark", label: "Tối", icon: MoonIcon },
  { value: "system", label: "Hệ thống", icon: MonitorIcon },
] as const

function isThemeChoice(value: unknown): value is ThemeSelection {
  return themes.some((option) => option.value === value)
}

/**
 * The stored choice is only known in the browser, so nothing is shown as
 * selected until hydration to avoid a server/client mismatch.
 */
function useThemeChoice() {
  const { theme, setTheme } = useTheme()
  const hydrated = useHydrated()
  return { theme: hydrated ? theme : undefined, setTheme }
}

/** Segmented Light / Dark / System control. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeChoice()

  return (
    <ToggleGroup
      aria-label="Giao diện"
      variant="outline"
      spacing={0}
      value={theme ? [theme] : []}
      onValueChange={(value) => {
        if (isThemeChoice(value[0])) setTheme(value[0])
      }}
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value}>
          <Icon aria-hidden />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Theme choice as radio items, for use inside a DropdownMenuContent. */
export function ThemeMenuGroup() {
  const { theme, setTheme } = useThemeChoice()

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Giao diện</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme ?? ""}
        onValueChange={(value) => {
          if (isThemeChoice(value)) setTheme(value)
        }}
      >
        {themes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            <Icon aria-hidden />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  )
}
