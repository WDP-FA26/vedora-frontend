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
import { usePublicRecipes } from "@/features/recipes/hooks/use-recipe-catalog"

/** The "Công thức" tab: the public recipe catalog, with the full recipe in a dialog. */
export function RecipeFeed() {
  const { recipes, error, isLoading, isLoadingMore, hasMore, loadMore, retry } = usePublicRecipes()
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
              <EmptyDescription>Kho công thức hiện chưa có món nào.</EmptyDescription>
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
            <RecipeCard recipe={recipe} onOpen={() => setOpenId(recipe.id)} />
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
