"use client"

import { useEffect, useRef, useState } from "react"
import { ClockIcon, RotateCcwIcon, UsersIcon, UtensilsCrossedIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { usePublicRecipe, usePublicRecipes } from "@/features/recipes/hooks/use-recipe-catalog"
import type { Recipe, RecipeDetail } from "@/features/recipes/schemas"
import { cn } from "@/lib/utils"

function totalMinutes(recipe: Pick<Recipe, "prepMinutes" | "cookMinutes">) {
  const { prepMinutes, cookMinutes } = recipe
  return prepMinutes === null && cookMinutes === null ? null : (prepMinutes ?? 0) + (cookMinutes ?? 0)
}

function formatQuantity(item: RecipeDetail["ingredients"][number]) {
  return [item.quantity, item.unit].filter((part) => part !== null && part !== "").join(" ")
}

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

function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const minutes = totalMinutes(recipe)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <RecipeImage imageUrl={recipe.imageUrl} className="aspect-[16/9] w-full" />
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-heading text-base font-bold">{recipe.title}</span>
        <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {minutes !== null && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon aria-hidden className="size-3.5" />
              {minutes} phút
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <UsersIcon aria-hidden className="size-3.5" />
            {recipe.servings} khẩu phần
          </span>
          <span>{recipe.ingredientCount} nguyên liệu</span>
        </span>
        {recipe.post && (
          <span className="text-xs text-muted-foreground">Bởi {recipe.post.author.fullName}</span>
        )}
      </span>
    </button>
  )
}

function RecipeDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { recipe, error } = usePublicRecipe(id)
  const minutes = recipe ? totalMinutes(recipe) : null

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle size="lg">{recipe?.title ?? "Công thức"}</DialogTitle>
        <DialogDescription className={recipe?.description ? undefined : "sr-only"}>
          {recipe?.description ?? "Nguyên liệu và các bước thực hiện."}
        </DialogDescription>
        {error && <p role="alert" className="text-sm text-destructive">Không tải được công thức này.</p>}
        {!recipe && !error && <div className="h-40 overflow-hidden rounded-2xl">
            <Skeleton className="size-full" />
          </div>}
        {recipe && (
          <div className="space-y-5">
            <RecipeImage imageUrl={recipe.imageUrl} className="aspect-[16/9] w-full rounded-2xl" />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {minutes !== null && <span>{minutes} phút</span>}
              <span>{recipe.servings} khẩu phần</span>
            </p>
            {recipe.conflicts.length > 0 && (
              <div role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold">Lưu ý nguyên liệu</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {recipe.conflicts.map((conflict) => (
                    <li key={conflict.ruleId}>
                      {conflict.a.name} và {conflict.b.name}: {conflict.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <section aria-label="Nguyên liệu">
              <h3 className="font-heading text-sm font-bold">Nguyên liệu</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {recipe.ingredients.map((item) => (
                  <li key={item.ingredientId} className="flex justify-between gap-3">
                    <span>
                      {item.name}
                      {item.note && <span className="text-muted-foreground"> ({item.note})</span>}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{formatQuantity(item)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Cách làm">
              <h3 className="font-heading text-sm font-bold">Cách làm</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6">
                {recipe.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The dish photo, or a plain "No Image" panel when there is none or it fails to load. */
function RecipeImage({ imageUrl, className }: { imageUrl: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (imageUrl && imageUrl !== failedUrl) {
    return (
      // Hot-linked from another site, so the Next image optimizer is not used.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(imageUrl)}
        className={cn("bg-secondary object-cover", className)}
      />
    )
  }
  return (
    <span
      role="img"
      aria-label="No Image"
      className={cn(
        "flex items-center justify-center bg-muted text-sm font-medium text-muted-foreground",
        className
      )}
    >
      No Image
    </span>
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
