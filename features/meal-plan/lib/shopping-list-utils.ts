import { DAY_LABELS, SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import { formatQuantity } from "@/features/meal-plan/lib/format"
import type { Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import type { ShoppingItem } from "@/features/meal-plan/schemas/shopping-list.schema"

export const PEOPLE_COUNTS = [1, 2, 3, 4] as const
export type PeopleCount = (typeof PEOPLE_COUNTS)[number]

const PEOPLE_STORAGE_KEY = "vedora:shopping-people"

export function loadPeopleCount(): PeopleCount {
  if (typeof window === "undefined") return 1
  try {
    const raw = Number(window.localStorage.getItem(PEOPLE_STORAGE_KEY))
    const matched = PEOPLE_COUNTS.find((count) => count === raw)
    return matched ?? 1
  } catch {
    return 1
  }
}

export function savePeopleCount(count: PeopleCount) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PEOPLE_STORAGE_KEY, String(count))
  } catch {
  }
}

function checkedStorageKey(weekStart: string) {
  return `vedora:shopping-checked:${weekStart}`
}

export function loadCheckedKeys(weekStart: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(checkedStorageKey(weekStart))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string")
  } catch {
    return []
  }
}

export function saveCheckedKeys(weekStart: string, keys: readonly string[]) {
  if (typeof window === "undefined") return
  try {
    if (keys.length === 0) {
      window.localStorage.removeItem(checkedStorageKey(weekStart))
      return
    }
    window.localStorage.setItem(checkedStorageKey(weekStart), JSON.stringify(keys))
  } catch {
  }
}

export function scaledContributionQuantity(
  quantity: string | null,
  servings: number,
  people: PeopleCount
): number | null {
  if (quantity === null) return null
  const numeric = Number(quantity)
  if (!Number.isFinite(numeric)) return null
  const divisor = servings > 0 ? servings : 1
  return (numeric / divisor) * people
}

export function formatScaledNumber(value: number | null, unit: string | null): string | null {
  if (value === null) return null
  const rounded = Math.round(value * 100) / 100
  return [formatQuantity(String(rounded)), unit].filter(Boolean).join(" ")
}

export function itemAmount(item: ShoppingItem, people: PeopleCount) {
  let sum = 0
  let knownCount = 0
  let hasUnknown = item.hasUnknownQuantity
  for (const source of item.contributions) {
    const scaled = scaledContributionQuantity(source.quantity, source.servings, people)
    if (scaled === null) {
      hasUnknown = true
    } else {
      sum += scaled
      knownCount += 1
    }
  }
  const known = knownCount > 0 ? formatScaledNumber(sum, item.unit) : null
  if (!known) return item.unit ? `Chưa rõ lượng (${item.unit})` : "Chưa rõ lượng"
  return hasUnknown ? `${known} + phần chưa rõ lượng` : known
}

export function listText(items: ShoppingItem[], people: PeopleCount, checked: ReadonlySet<string>) {
  return items
    .map((item) => {
      const key = `${item.ingredientId}:${item.unit ?? ""}`
      const prefix = checked.has(key) ? "[x]" : "[ ]"
      return `${prefix} ${item.name}: ${itemAmount(item, people)}`
    })
    .join("\n")
}

export function dayNames(days: readonly Weekday[]) {
  return days.map((day) => DAY_LABELS[day]).join(", ")
}

function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("đ", "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function matchesAnyQuery(itemName: string, queries: readonly string[]): boolean {
  const normalizedItem = normalizeMatchText(itemName)
  for (const query of queries) {
    const normalizedQuery = normalizeMatchText(query)
    if (!normalizedQuery) continue
    if (normalizedItem.includes(normalizedQuery) || normalizedQuery.includes(normalizedItem)) {
      return true
    }
  }
  return false
}

export function mealLabel(day: Weekday, section: ShoppingItem["contributions"][number]["section"]) {
  const meal = section === "OTHER" ? "món khác" : `bữa ${SECTION_LABELS[section].toLowerCase()}`
  return `${DAY_LABELS[day]}, ${meal}`
}
