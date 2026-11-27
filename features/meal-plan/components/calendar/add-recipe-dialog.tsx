"use client"

import { useEffect, useState } from "react"
import { BookmarkIcon, ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { searchRecipeOptions } from "@/features/meal-plan/api/meal-plan.api"
import { slotLabel } from "@/features/meal-plan/components/calendar/calendar-dish-chip"
import type { RecipeOption, SlotRef } from "@/features/meal-plan/schemas/meal-plan.schema"
import { useFavoriteRecipes } from "@/features/recipes/hooks/use-recipe-favorite"
import { RECIPE_TAGS, tagView, type RecipeTag } from "@/features/recipes/tags"

const SEARCH_DEBOUNCE_MS = 250

export function AddRecipeDialog({
  slot,
  onClose,
  onPick,
}: {
  slot: SlotRef | null
  onClose: () => void
  onPick: (recipeId: string) => void
}) {
  const { accessToken } = useAuth()
  const [sourceTab, setSourceTab] = useState<"all" | "saved">("all")
  const [query, setQuery] = useState("")
  const [quickOnly, setQuickOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState<RecipeTag | null>(null)
  const [results, setResults] = useState<RecipeOption[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const open = slot !== null
  const favorites = useFavoriteRecipes(1)

  useEffect(() => {
    if (!open || !accessToken || sourceTab !== "all") return
    let stale = false
    const delay = query === "" ? 0 : SEARCH_DEBOUNCE_MS
    const timer = setTimeout(async () => {
      setSearching(true)
      setFailed(false)
      try {
        const page = await searchRecipeOptions(accessToken, query)
        if (!stale) setResults(page.items)
      } catch {
        if (!stale) setFailed(true)
      } finally {
        if (!stale) setSearching(false)
      }
    }, delay)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [open, accessToken, query, sourceTab])

  function close() {
    setQuery("")
    setResults([])
    setFailed(false)
    setQuickOnly(false)
    setTagFilter(null)
    setSourceTab("all")
    onClose()
  }

  function emptyText() {
    if (failed) return "Không tìm được công thức. Hãy thử lại."
    if (searching) return "Đang tìm…"
    return "Không có món phù hợp."
  }

  const filteredResults = results.filter((recipe) => {
    if (quickOnly && (recipe.totalMinutes === null || recipe.totalMinutes > 30)) return false
    return true
  })

  const savedItems = (favorites.data?.items ?? []).filter((recipe) => {
    const minutes =
      recipe.prepMinutes === null && recipe.cookMinutes === null
        ? null
        : (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
    if (quickOnly && (minutes === null || minutes > 30)) return false
    if (tagFilter !== null && recipe.tag !== tagFilter) return false
    return true
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm món</DialogTitle>
          <DialogDescription>
            {slot ? slotLabel(slot) : ""}. Chỉ hiện món phù hợp với hồ sơ ăn uống của bạn.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={sourceTab} onValueChange={(next) => setSourceTab(next as "all" | "saved")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">Tất cả công thức</TabsTrigger>
            <TabsTrigger value="saved">
              <BookmarkIcon aria-hidden /> Đã lưu
            </TabsTrigger>
          </TabsList>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant={quickOnly ? "default" : "outline"}
              aria-pressed={quickOnly}
              onClick={() => setQuickOnly((prev) => !prev)}
            >
              <ClockIcon aria-hidden /> ≤ 30 phút
            </Button>
            {sourceTab === "saved" &&
              RECIPE_TAGS.slice(0, 5).map((tag) => {
                const active = tagFilter === tag
                return (
                  <Button
                    key={tag}
                    type="button"
                    size="xs"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    onClick={() => setTagFilter(active ? null : tag)}
                  >
                    {tagView(tag).label}
                  </Button>
                )
              })}
          </div>

          <TabsContent value="all" className="mt-3">
            <Combobox
              items={filteredResults}
              value={null}
              inputValue={query}
              onInputValueChange={setQuery}
              onValueChange={(recipe: RecipeOption | null) => {
                if (!recipe) return
                onPick(recipe.id)
                close()
              }}
              itemToStringLabel={(recipe: RecipeOption) => recipe.title}
              isItemEqualToValue={(a: RecipeOption, b: RecipeOption) => a.id === b.id}
              filter={null}
            >
              <ComboboxInput
                maxLength={100}
                placeholder="Gõ tên món hoặc nguyên liệu, ví dụ: đậu hũ"
                aria-label="Tìm công thức"
                showTrigger={false}
              />
              <ComboboxContent>
                <ComboboxEmpty>{emptyText()}</ComboboxEmpty>
                <ComboboxList>
                  {(recipe: RecipeOption) => (
                    <ComboboxItem key={recipe.id} value={recipe}>
                      <span className="min-w-0 flex-1 truncate font-medium">{recipe.title}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        {recipe.totalMinutes !== null && <span>{recipe.totalMinutes} phút</span>}
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </TabsContent>

          <TabsContent value="saved" className="mt-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Danh sách công thức bạn đã lưu (hệ thống vẫn kiểm tra dị ứng khi lưu vào lịch).
              </p>
              {favorites.isLoading && !favorites.data ? (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Spinner aria-hidden /> Đang tải công thức đã lưu…
                </p>
              ) : savedItems.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Chưa có công thức đã lưu nào phù hợp với bộ lọc.
                </p>
              ) : (
                <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {savedItems.map((recipe) => {
                    const minutes =
                      recipe.prepMinutes === null && recipe.cookMinutes === null
                        ? null
                        : (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
                    return (
                      <li key={recipe.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onPick(recipe.id)
                            close()
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">{recipe.title}</span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                            {typeof recipe.caloriesPerServing === "number" && (
                              <span>~{recipe.caloriesPerServing} kcal</span>
                            )}
                            {minutes !== null && <span>{minutes} phút</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
