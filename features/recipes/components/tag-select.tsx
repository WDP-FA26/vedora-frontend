"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_TAG_VIEW,
  RECIPE_TAGS,
  RECIPE_TAG_VIEWS,
  recipeTagSchema,
  type RecipeTag,
} from "@/features/recipes/tags"

const NO_TAG = "NONE"

const ITEMS = [
  { value: NO_TAG, label: `Mặc định (${DEFAULT_TAG_VIEW.label})`, icon: DEFAULT_TAG_VIEW.icon },
  ...RECIPE_TAGS.map((tag) => ({
    value: tag,
    label: RECIPE_TAG_VIEWS[tag].label,
    icon: RECIPE_TAG_VIEWS[tag].icon,
  })),
]

/** `value` is a tag, or "" for none. */
export function TagSelect({
  value,
  onChange,
}: {
  value: RecipeTag | ""
  onChange: (value: RecipeTag | "") => void
}) {
  function handleChange(next: string | null) {
    const parsed = recipeTagSchema.safeParse(next)
    onChange(parsed.success ? parsed.data : "")
  }

  return (
    <Select items={ITEMS} value={value === "" ? NO_TAG : value} onValueChange={handleChange}>
      <SelectTrigger id="tag" className="w-full sm:w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map(({ value: itemValue, label, icon: Icon }) => (
          <SelectItem key={itemValue} value={itemValue}>
            <Icon aria-hidden />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
