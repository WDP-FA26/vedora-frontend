"use client"

import { useState } from "react"
import Link from "next/link"
import { useSWRConfig } from "swr"
import { BookmarkIcon, CalendarPlusIcon, ClockIcon, FlameIcon, UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { NUTRITION_PILLAR_META } from "@/features/dietary/dietary"
import {
  fetchMealPlan,
  isMealPlanKey,
  MEAL_PLANNER_PATH,
  mealPlanKey,
  saveMealDays,
} from "@/features/meal-plan/api/meal-plan.api"
import {
  DAY_LABELS,
  editableDaysOf,
  SECTION_LABELS,
  todayOf,
} from "@/features/meal-plan/lib/dates"
import { inputsForChanges, recipesAt } from "@/features/meal-plan/lib/plan-mutations"
import {
  MAX_DISHES_PER_SECTION,
  MEAL_SECTIONS,
  WEEKDAYS,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/schemas/meal-plan.schema"
import { RecipeRating } from "@/features/recipes/components/recipe-rating"
import { usePublicRecipe } from "@/features/recipes/hooks/use-recipe-catalog"
import { useRecipeFavorite } from "@/features/recipes/hooks/use-recipe-favorite"
import type { PublicRecipe, PublicRecipeDetail } from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"
import { cn } from "@/lib/utils"

function totalMinutes(recipe: Pick<PublicRecipe, "prepMinutes" | "cookMinutes">) {
  const { prepMinutes, cookMinutes } = recipe
  return prepMinutes === null && cookMinutes === null ? null : (prepMinutes ?? 0) + (cookMinutes ?? 0)
}

function formatQuantity(item: PublicRecipeDetail["ingredients"][number]) {
  return [item.quantity, item.unit].filter((part) => part !== null && part !== "").join(" ")
}

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

export function RecipeCard({
  recipe,
  label,
  onOpen,
}: {
  recipe: PublicRecipe
  label?: string
  onOpen: () => void
}) {
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
          <span className="flex items-start justify-between gap-2">
            <span className="font-heading text-base font-bold">{recipe.title}</span>
            {label && (
              <Badge variant="secondary" className="shrink-0">
                {label}
              </Badge>
            )}
          </span>
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
            {typeof recipe.caloriesPerServing === "number" && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <FlameIcon aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" />
                ~{recipe.caloriesPerServing} kcal/suất
              </span>
            )}
            <span>{recipe.ingredientCount} nguyên liệu</span>
          </span>
          {recipe.post && (
            <span className="text-xs text-muted-foreground">Bởi {recipe.post.author.fullName}</span>
          )}
        </span>
      </button>
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
                {typeof recipe.caloriesPerServing === "number" && (
                  <span className="font-medium text-foreground">
                    ~{recipe.caloriesPerServing} kcal / 1 suất ăn
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <AddToMealPlanButton recipeId={recipe.id} recipeTitle={recipe.title} />
                <FavoriteButton recipe={recipe} withLabel />
              </div>
            </div>
            {recipe.nutritionPillars && recipe.nutritionPillars.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Nhóm dưỡng chất chay">
                {recipe.nutritionPillars.map((pillar) => (
                  <Badge key={pillar} variant="secondary" title={NUTRITION_PILLAR_META[pillar].tip}>
                    {NUTRITION_PILLAR_META[pillar].label}
                  </Badge>
                ))}
              </div>
            )}
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

function AddToMealPlanButton({
  recipeId,
  recipeTitle,
}: {
  recipeId: string
  recipeTitle: string
}) {
  const { user, accessToken } = useAuth()
  const { mutate: swrMutate } = useSWRConfig()
  const [open, setOpen] = useState(false)
  const [pickedDay, setPickedDay] = useState<Weekday | null>(null)
  const [section, setSection] = useState<MealSection>("LUNCH")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canPlan = user !== null && user.accountType === "PERSONAL"
  const plan = useAuthedSWR(open && canPlan ? mealPlanKey() : null, fetchMealPlan)

  if (!canPlan) return null

  const editableDays = plan.data ? editableDaysOf(plan.data) : []
  const defaultDay = plan.data ? (todayOf(plan.data) ?? editableDays[0] ?? "MON") : "MON"
  const activeDay = pickedDay && editableDays.includes(pickedDay) ? pickedDay : defaultDay

  async function save() {
    if (!accessToken || !plan.data || saving) return
    const existing = recipesAt(plan.data, { day: activeDay, section }).map((item) => item.id)
    if (existing.includes(recipeId)) {
      setError("Món này đã có trong bữa đã chọn.")
      return
    }
    if (existing.length >= MAX_DISHES_PER_SECTION) {
      setError(`Mỗi bữa tối đa ${MAX_DISHES_PER_SECTION} món.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const daysInput = inputsForChanges(plan.data, [
        { day: activeDay, section, recipeIds: [...existing, recipeId] },
      ])
      await saveMealDays(accessToken, plan.data.weekStart, daysInput)
      void swrMutate(isMealPlanKey)
      setOpen(false)
      toast.add({
        title: `Đã thêm "${recipeTitle}"`,
        description: `${DAY_LABELS[activeDay]} · Bữa ${SECTION_LABELS[section].toLowerCase()}`,
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Chưa thêm được vào thực đơn.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        onClick={() => {
          setError(null)
          setOpen((prev) => !prev)
        }}
      >
        <CalendarPlusIcon aria-hidden />
        Thêm vào thực đơn
      </Button>

      {open && (
        <div className="mt-2 space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
          {plan.isLoading && !plan.data ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner aria-hidden /> Đang tải lịch tuần này…
            </p>
          ) : editableDays.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tuần này đã qua hết.{" "}
              <Link href={MEAL_PLANNER_PATH} className="font-semibold text-primary hover:underline">
                Mở Lên thực đơn
              </Link>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium">
                  Ngày
                  <NativeSelect
                    className="mt-1 w-full"
                    value={activeDay}
                    onChange={(event) => {
                      const next = WEEKDAYS.find((item) => item === event.target.value)
                      if (next) setPickedDay(next)
                      setError(null)
                    }}
                  >
                    {editableDays.map((day) => (
                      <NativeSelectOption key={day} value={day}>
                        {DAY_LABELS[day]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className="text-xs font-medium">
                  Bữa
                  <NativeSelect
                    className="mt-1 w-full"
                    value={section}
                    onChange={(event) => {
                      const next = MEAL_SECTIONS.find((item) => item === event.target.value)
                      if (next) setSection(next)
                      setError(null)
                    }}
                  >
                    {MEAL_SECTIONS.map((item) => (
                      <NativeSelectOption key={item} value={item}>
                        {SECTION_LABELS[item]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              </div>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button type="button" size="xs" disabled={saving} onClick={() => void save()}>
                  {saving && <Spinner aria-hidden />}
                  Lưu vào lịch
                </Button>
                <Link
                  href={MEAL_PLANNER_PATH}
                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Xem lịch tuần →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function RecipeImage({ imageUrl, className }: { imageUrl: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (imageUrl && imageUrl !== failedUrl) {
    return (
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
