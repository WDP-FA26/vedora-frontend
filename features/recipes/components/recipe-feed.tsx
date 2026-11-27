"use client"

import { useEffect, useRef, useState } from "react"
import {
  ChevronDownIcon,
  LayoutGridIcon,
  RotateCcwIcon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export function RecipeFeed() {
  const { categories } = usePublicRecipeCategories()
  const [selected, setSelected] = useState<RecipeCategory | null>(null)

  return (
    <>
      {categories.length > 0 && (
        <CategoryPicker categories={categories} selected={selected} onSelect={setSelected} />
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

function categoryLabels(categories: RecipeCategory[]) {
  const labels = new Map<RecipeTag, string>()
  for (const category of categories) {
    if (!labels.has(category.baseTag)) labels.set(category.baseTag, category.name)
  }
  return labels
}

const ALL_CATEGORIES = "all"

function CategoryPicker({
  categories,
  selected,
  onSelect,
}: {
  categories: RecipeCategory[]
  selected: RecipeCategory | null
  onSelect: (category: RecipeCategory | null) => void
}) {
  const SelectedIcon = selected ? RECIPE_CATEGORY_ICON_VIEWS[selected.icon].icon : LayoutGridIcon

  function choose(value: unknown) {
    if (value === ALL_CATEGORIES) {
      onSelect(null)
      return
    }
    onSelect(categories.find(({ id }) => id === value) ?? null)
  }

  return (
    <div className="flex items-center gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
      <span className="text-sm text-muted-foreground">Danh mục</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" shape="pill" />}
          aria-label={`Danh mục: ${selected?.name ?? "Tất cả"}`}
        >
          <SelectedIcon aria-hidden />
          {selected?.name ?? "Tất cả"}
          <ChevronDownIcon aria-hidden data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuRadioGroup value={selected?.id ?? ALL_CATEGORIES} onValueChange={choose}>
            <DropdownMenuRadioItem value={ALL_CATEGORIES} closeOnClick>
              <LayoutGridIcon aria-hidden />
              Tất cả
            </DropdownMenuRadioItem>
            {categories.map((category) => {
              const Icon = RECIPE_CATEGORY_ICON_VIEWS[category.icon].icon
              return (
                <DropdownMenuRadioItem key={category.id} value={category.id} closeOnClick>
                  <Icon aria-hidden />
                  {category.name}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
