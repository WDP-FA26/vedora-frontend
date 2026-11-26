"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcwIcon, UtensilsCrossedIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { RecipeCard, RecipeDialog } from "@/features/recipes/components/recipe-card"
import { RECIPE_CATEGORY_ICON_VIEWS } from "@/features/recipes/category-icons"
import {
  usePublicRecipeCategories,
  usePublicRecipes,
} from "@/features/recipes/hooks/use-recipe-catalog"
import type { RecipeCategory } from "@/features/recipes/schemas"
import type { RecipeTag } from "@/features/recipes/tags"

/**
 * The "Công thức" tab: the public recipe catalog, filtered by category chips,
 * with the full recipe in a dialog. A category shows the recipes whose `tag`
 * is its `baseTag`.
 */
export function RecipeFeed() {
  const { categories } = usePublicRecipeCategories()
  const [selected, setSelected] = useState<RecipeCategory | null>(null)

  return (
    <>
      {categories.length > 0 && (
        <CategoryChips categories={categories} selected={selected} onSelect={setSelected} />
      )}
      <RecipeList
        tag={selected?.baseTag ?? null}
        emptyText={
          selected
            ? `Danh mục “${selected.name}” chưa có món nào.`
            : "Kho công thức hiện chưa có món nào."
        }
        labels={categoryLabels(categories)}
      />
    </>
  )
}

/** Each dish type's name as the admin calls it: the first category using it as `baseTag`. */
function categoryLabels(categories: RecipeCategory[]) {
  const labels = new Map<RecipeTag, string>()
  for (const category of categories) {
    if (!labels.has(category.baseTag)) labels.set(category.baseTag, category.name)
  }
  return labels
}

function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: RecipeCategory[]
  selected: RecipeCategory | null
  onSelect: (category: RecipeCategory | null) => void
}) {
  return (
    <div
      role="group"
      aria-label="Lọc theo danh mục"
      className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pt-4 [scrollbar-width:none] sm:px-5 sm:pt-5 [&::-webkit-scrollbar]:hidden"
    >
      <Button
        type="button"
        size="sm"
        shape="pill"
        variant={selected === null ? "default" : "outline"}
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        Tất cả
      </Button>
      {categories.map((category) => {
        const Icon = RECIPE_CATEGORY_ICON_VIEWS[category.icon].icon
        const active = selected?.id === category.id
        return (
          <Button
            key={category.id}
            type="button"
            size="sm"
            shape="pill"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            title={category.description ?? undefined}
            onClick={() => onSelect(category)}
          >
            <Icon aria-hidden />
            {category.name}
          </Button>
        )
      })}
    </div>
  )
}

function RecipeList({
  tag,
  emptyText,
  labels,
}: {
  tag: RecipeTag | null
  emptyText: string
  labels: Map<RecipeTag, string>
}) {
  const { recipes, error, isLoading, isLoadingMore, hasMore, loadMore, retry } = usePublicRecipes(tag)
  const [openId, setOpenId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div role="status" aria-label="Đang tải công thức" className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-56 overflow-hidden rounded-2xl">
            <Skeleton className="size-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error && recipes.length === 0) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
        <span>Không tải được công thức. Kiểm tra kết nối rồi thử lại.</span>
        <Button type="button" variant="outline" size="sm" shape="pill" onClick={retry}>
          <RotateCcwIcon aria-hidden />
          Thử lại
        </Button>
      </div>
    )
  }

  if (recipes.length === 0) {
    return (
      <div className="px-3 py-6">
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossedIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Chưa có công thức</EmptyTitle>
              <EmptyDescription>{emptyText}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-28 sm:p-5 sm:pb-5">
      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <RecipeCard
              recipe={recipe}
              label={recipe.tag ? labels.get(recipe.tag) : undefined}
              onOpen={() => setOpenId(recipe.id)}
            />
          </li>
        ))}
      </ul>
      {hasMore && <LoadMoreSentinel loading={isLoadingMore} onVisible={loadMore} />}
      <RecipeDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

/** Calls `onVisible` whenever it scrolls into view, so the next page loads ahead of the reader. */
function LoadMoreSentinel({ loading, onVisible }: { loading: boolean; onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible()
      },
      { rootMargin: "400px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading, onVisible])

  return (
    <div ref={ref} className="mt-4 flex h-10 items-center justify-center">
      {loading && <Spinner aria-label="Đang tải thêm công thức" />}
    </div>
  )
}
