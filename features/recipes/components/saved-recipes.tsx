"use client"

import { useState } from "react"
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { RecipeCard, RecipeDialog } from "@/features/recipes/components/recipe-card"
import { useFavoriteRecipes } from "@/features/recipes/hooks/use-recipe-favorite"

/**
 * The recipes the signed-in user saved, newest saved first, a page at a time.
 * A recipe unsaved here leaves the list once it reloads.
 */
export function SavedRecipes() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading, retry } = useFavoriteRecipes(page)
  const [openId, setOpenId] = useState<string | null>(null)

  const totalPages = data?.meta.totalPages ?? 0
  // Unsaving the last recipe of the last page leaves it empty: step back.
  const pastEnd = data !== null && data.meta.page === page && data.items.length === 0 && page > 1
  if (pastEnd) setPage(Math.max(1, totalPages))

  if (isLoading && !data) {
    return (
      <div role="status" aria-label="Đang tải công thức đã lưu" className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-56 overflow-hidden rounded-2xl">
            <Skeleton className="size-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error && !data) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
        <span>Không tải được công thức đã lưu. Kiểm tra kết nối rồi thử lại.</span>
        <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => retry()}>
          <RotateCcwIcon aria-hidden />
          Thử lại
        </Button>
      </div>
    )
  }

  if (!data || (data.items.length === 0 && !pastEnd)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookmarkIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Chưa lưu công thức nào</EmptyTitle>
          <EmptyDescription>
            Bấm biểu tượng dấu trang trên một công thức để lưu lại, rồi tìm nó ở đây.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="p-4 pb-28 sm:p-5 sm:pb-5">
      <p className="mb-3 text-sm text-muted-foreground">{data.meta.totalItems} công thức đã lưu</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.items.map((recipe) => (
          <li key={recipe.id}>
            <RecipeCard recipe={recipe} onOpen={() => setOpenId(recipe.id)} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav aria-label="Phân trang công thức đã lưu" className="mt-4 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            shape="pill"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeftIcon aria-hidden />
            Trang trước
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Trang {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            shape="pill"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
            <ChevronRightIcon aria-hidden />
          </Button>
        </nav>
      )}
      <RecipeDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
