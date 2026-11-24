"use client"

import { ArrowRightLeftIcon, FlameIcon, MessageCircleIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  NUTRITION_PILLAR_META,
  type NutritionPillar,
} from "@/features/dietary/dietary"
import { MealArt } from "@/features/meal-plan/components/meal-art"
import {
  DAY_LABELS,
  SECTION_LABELS,
  type MealRecipe,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { usePublicRecipe } from "@/features/recipes/hooks/use-recipe-catalog"

export type OpenedDish = {
  recipeId: string
  title: string
  /** The slot the dish sits in; a dish opened from outside the plan (the voice agent) has none. */
  day?: Weekday
  section?: MealSection
  /** What the saved plan already knows about the dish; shown while the full recipe loads. */
  detail?: MealRecipe
}

type RecipeView = {
  imageUrl: string | null
  servings: number
  minutes: number | null
  caloriesPerServing: number | null
  nutritionPillars: NutritionPillar[]
  description: string | null
  ingredients: MealRecipe["ingredients"]
  steps: string[]
}

function totalMinutes(prep: number | null, cook: number | null) {
  if (prep === null && cook === null) return null
  return (prep ?? 0) + (cook ?? 0)
}

type Props = {
  open: boolean
  dish: OpenedDish | null
  onClose: () => void
  onAsk?: () => void
  onMove?: () => void
  onRemove?: () => void
}

/** A large side sheet with the photo, ingredients and steps of one dish. */
export function RecipeSheet({ open, dish, onClose, onAsk, onMove, onRemove }: Props) {
  const { recipe: full, error } = usePublicRecipe(open && dish ? dish.recipeId : null)

  let view: RecipeView | null = null
  if (full) {
    view = {
      imageUrl: full.imageUrl,
      servings: full.servings,
      minutes: totalMinutes(full.prepMinutes, full.cookMinutes),
      caloriesPerServing: full.caloriesPerServing ?? dish?.detail?.caloriesPerServing ?? null,
      nutritionPillars: full.nutritionPillars ?? dish?.detail?.nutritionPillars ?? [],
      description: full.description,
      ingredients: full.ingredients,
      steps: full.steps,
    }
  } else if (dish?.detail) {
    view = {
      imageUrl: dish.detail.imageUrl,
      servings: dish.detail.servings,
      minutes: totalMinutes(dish.detail.prepMinutes, dish.detail.cookMinutes),
      caloriesPerServing: dish.detail.caloriesPerServing ?? null,
      nutritionPillars: dish.detail.nutritionPillars ?? [],
      description: null,
      ingredients: dish.detail.ingredients,
      steps: dish.detail.steps,
    }
  }

  const meta: string[] = []
  if (view && view.servings > 0) meta.push(`Công thức gốc ${view.servings} khẩu phần`)
  if (view && view.minutes !== null) meta.push(`khoảng ${view.minutes} phút`)

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-[side=right]:w-full data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-2xl">
        {dish && (
          <>
            <MealArt
              section={dish.section ?? "OTHER"}
              imageUrl={view?.imageUrl}
              className="aspect-[16/10] size-auto w-full shrink-0 rounded-none"
              photoClassName="aspect-auto h-auto max-h-[60dvh] object-contain"
            />
            <SheetHeader>
              {dish.day && dish.section && (
                <p className="text-xs font-semibold text-primary">
                  {DAY_LABELS[dish.day]} · Bữa {SECTION_LABELS[dish.section].toLowerCase()}
                </p>
              )}
              <SheetTitle size="lg">{dish.title}</SheetTitle>
              <SheetDescription>{meta.join(" · ")}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 px-6 pb-6 text-sm">
              {view && (view.caloriesPerServing !== null || view.nutritionPillars.length > 0) && (
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/30 p-3.5 text-xs">
                  {view.caloriesPerServing !== null && (
                    <p className="flex items-center gap-1.5 font-semibold text-foreground">
                      <FlameIcon aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />
                      Phần của bạn: ~{view.caloriesPerServing} kcal / 1 suất ăn
                    </p>
                  )}
                  {view.nutritionPillars.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {view.nutritionPillars.map((pillar) => (
                        <Badge key={pillar} variant="secondary" title={NUTRITION_PILLAR_META[pillar].tip}>
                          {NUTRITION_PILLAR_META[pillar].label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!view && !error && (
                <div className="flex flex-col gap-2" aria-label="Đang tải công thức">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              )}
              {!view && error && (
                <p role="alert" className="text-destructive">Không tải được công thức này.</p>
              )}
              {view?.description && <p className="leading-6 text-muted-foreground">{view.description}</p>}
              {view && (
                <section className="flex flex-col gap-2">
                  <h3 className="font-semibold">Nguyên liệu</h3>
                  {view.ingredients.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {view.ingredients.map(({ name, quantity, unit, note }, index) => (
                        <li key={name + "-" + index}>
                          {[quantity, unit].filter((part) => part !== null && part !== "").join(" ")} {name}
                          {note && <span className="text-muted-foreground">, {note}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Chưa có danh sách nguyên liệu.</p>
                  )}
                </section>
              )}
              {view && view.steps.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="font-semibold">Cách làm</h3>
                  <ol className="list-decimal space-y-2 pl-5">
                    {view.steps.map((step, index) => <li key={index}>{step}</li>)}
                  </ol>
                </section>
              )}
            </div>

            {(onAsk || onMove || onRemove) && (
              <SheetFooter>
                {onAsk && (
                  <Button variant="outline" onClick={onAsk}><MessageCircleIcon aria-hidden /> Hỏi trợ lý</Button>
                )}
                {onMove && (
                  <Button variant="outline" onClick={onMove}><ArrowRightLeftIcon aria-hidden /> Chuyển sang…</Button>
                )}
                {onRemove && (
                  <Button variant="destructive" onClick={onRemove}><Trash2Icon aria-hidden /> Xóa khỏi bữa</Button>
                )}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
