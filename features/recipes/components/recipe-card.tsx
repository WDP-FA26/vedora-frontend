"use client"

import { useState } from "react"
import { BookmarkIcon, ClockIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { RecipeRating } from "@/features/recipes/components/recipe-rating"
import { usePublicRecipe } from "@/features/recipes/hooks/use-recipe-catalog"
import { useRecipeFavorite } from "@/features/recipes/hooks/use-recipe-favorite"
import type { PublicRecipe, PublicRecipeDetail } from "@/features/recipes/schemas"
import { cn } from "@/lib/utils"

function totalMinutes(recipe: Pick<PublicRecipe, "prepMinutes" | "cookMinutes">) {
  const { prepMinutes, cookMinutes } = recipe
  return prepMinutes === null && cookMinutes === null ? null : (prepMinutes ?? 0) + (cookMinutes ?? 0)
}

function formatQuantity(item: PublicRecipeDetail["ingredients"][number]) {
  return [item.quantity, item.unit].filter((part) => part !== null && part !== "").join(" ")
}

/** Saves or unsaves the recipe for the signed-in user; guests go to sign in. */
function FavoriteButton({
  recipe,
  withLabel = false,
  className,
}: {
  recipe: Pick<PublicRecipe, "id" | "title" | "isFavorite">
  withLabel?: boolean
  className?: string
}) {
  const { saved, pending, toggle } = useRecipeFavorite(recipe)
  const label = saved ? "Bỏ lưu" : "Lưu"

  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "overlay"}
      size={withLabel ? "sm" : "icon"}
      shape="pill"
      disabled={pending}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : `${label} công thức ${recipe.title}`}
      onClick={() => void toggle()}
      className={className}
    >
      <BookmarkIcon aria-hidden className={cn(saved && "fill-current text-primary")} />
      {withLabel && (saved ? "Đã lưu" : "Lưu công thức")}
    </Button>
  )
}

export function RecipeCard({ recipe, onOpen }: { recipe: PublicRecipe; onOpen: () => void }) {
  const minutes = totalMinutes(recipe)
  return (
    <div className="relative h-full">
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
      {/* A sibling of the card button: buttons can't nest. */}
      <FavoriteButton recipe={recipe} className="absolute top-2 right-2" />
    </div>
  )
}

export function RecipeDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {minutes !== null && <span>{minutes} phút</span>}
                <span>{recipe.servings} khẩu phần</span>
              </p>
              <FavoriteButton recipe={recipe} withLabel />
            </div>
            <RecipeRating key={recipe.id} recipeId={recipe.id} />
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
