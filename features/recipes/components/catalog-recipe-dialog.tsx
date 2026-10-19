"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import useSWR, { useSWRConfig } from "swr"
import { CalendarPlusIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  DAY_LABELS,
  fetchMealPlan,
  MEAL_PLAN_KEY,
  MEAL_PLANNER_PATH,
  MEAL_SECTIONS,
  mealPlanInvalidSchema,
  previewMealDays,
  problemText,
  saveMealDays,
  SECTION_LABELS,
  WEEKDAYS,
  type MealDayInput,
  type MealPlan,
  type MealPlanPreview,
  type MealPlanProblem,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import {
  catalogRecipeKey,
  fetchCatalogRecipe,
  type CatalogRecipe,
} from "@/features/recipes/lib/catalog-api"
import { ApiError } from "@/features/shared/lib/api-client"

/** Mirrors the API's limit on recipes in one meal. */
const MAX_SECTION_RECIPES = 6

const SECTION_FIELD: Record<MealSection, keyof Omit<MealDayInput, "day">> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
  OTHER: "others",
}

/** `PUT /meal-plan/days` replaces whole days, so the other sections are sent as saved. */
function dayWithRecipe(plan: MealPlan, day: Weekday, section: MealSection, recipeId: string) {
  const saved = plan.days.find((item) => item.day === day)
  const ids = (name: MealSection) =>
    saved?.sections.find((item) => item.section === name)?.recipes.map(({ id }) => id) ?? []
  const input: MealDayInput = {
    day,
    breakfast: ids("BREAKFAST"),
    lunch: ids("LUNCH"),
    dinner: ids("DINNER"),
    others: ids("OTHER"),
  }
  const field = SECTION_FIELD[section]
  if (input[field].includes(recipeId)) return { input: null, error: "Món này đã có trong bữa đó." }
  if (input[field].length >= MAX_SECTION_RECIPES) {
    return { input: null, error: `Mỗi bữa có tối đa ${MAX_SECTION_RECIPES} món.` }
  }
  input[field] = [...input[field], recipeId]
  return { input, error: null }
}

/**
 * A catalog recipe opened from a blog. Adding it to the meal plan previews the
 * change first and saves only when the reader presses "Áp dụng".
 */
export function CatalogRecipeDialog({
  recipeId,
  onOpenChange,
}: {
  /** The recipe to show; `null` closes the dialog. */
  recipeId: string | null
  onOpenChange: (open: boolean) => void
}) {
  // Focus the dialog itself: focusing its first button would scroll past the photo.
  const popup = useRef<HTMLDivElement>(null)

  return (
    <Dialog open={recipeId !== null} onOpenChange={onOpenChange}>
      <DialogContent ref={popup} initialFocus={popup} className="max-h-[85dvh] overflow-y-auto">
        {recipeId && <RecipeBody key={recipeId} id={recipeId} />}
      </DialogContent>
    </Dialog>
  )
}

function RecipeBody({ id }: { id: string }) {
  const { accessToken } = useAuth()
  const { data: recipe, error, isLoading } = useSWR(
    [catalogRecipeKey(id), accessToken] as const,
    fetchCatalogRecipe,
    { shouldRetryOnError: false }
  )

  if (isLoading) {
    return (
      <>
        <DialogTitle className="sr-only">Đang tải món</DialogTitle>
        <div className="flex justify-center py-8">
          <Spinner aria-label="Đang tải công thức" />
        </div>
      </>
    )
  }
  if (!recipe) {
    return (
      <DialogHeader>
        <DialogTitle>Không mở được món này</DialogTitle>
        <DialogDescription role="alert">
          {error instanceof ApiError && error.status === 404
            ? "Món này không còn trong kho công thức."
            : "Không tải được công thức. Thử lại sau nhé."}
        </DialogDescription>
      </DialogHeader>
    )
  }
  return <RecipeDetails recipe={recipe} />
}

function RecipeDetails({ recipe }: { recipe: CatalogRecipe }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const details = [
    recipe.servings > 0 ? `${recipe.servings} khẩu phần` : null,
    recipe.totalMinutes !== null ? `khoảng ${recipe.totalMinutes} phút` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      {recipe.imageUrl && !photoFailed && (
        // Hot-linked from another site, so the Next image optimizer is not used.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="aspect-[16/9] w-full rounded-2xl object-cover"
        />
      )}
      <DialogHeader>
        <DialogTitle size="lg">{recipe.title}</DialogTitle>
        {details && <DialogDescription>{details}</DialogDescription>}
      </DialogHeader>
      <div className="flex flex-col gap-4 text-sm">
        {recipe.description && <p className="leading-relaxed">{recipe.description}</p>}
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Nguyên liệu</h3>
          {recipe.ingredients.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {recipe.ingredients.map(({ ingredientId, name, quantity, unit, note }) => (
                <li key={ingredientId}>
                  {[quantity, unit].filter((part) => part !== null && part !== "").join(" ")}{" "}
                  {name}
                  {note && <span className="text-muted-foreground">, {note}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Chưa có danh sách nguyên liệu.</p>
          )}
        </section>
        {recipe.steps.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">Cách làm</h3>
            <ol className="list-decimal space-y-2 pl-5">
              {recipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </section>
        )}
        <AddToMealPlan recipe={recipe} />
      </div>
    </>
  )
}

type Stage =
  | { kind: "choose" }
  | { kind: "previewing" }
  | { kind: "preview"; days: MealDayInput[]; preview: MealPlanPreview }
  | { kind: "saving"; days: MealDayInput[]; preview: MealPlanPreview }
  | { kind: "saved" }

function AddToMealPlan({ recipe }: { recipe: CatalogRecipe }) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const pathname = usePathname()
  const [day, setDay] = useState<Weekday>("MON")
  const [section, setSection] = useState<MealSection>("LUNCH")
  const [stage, setStage] = useState<Stage>({ kind: "choose" })
  const [problems, setProblems] = useState<MealPlanProblem[]>([])
  const [error, setError] = useState<string | null>(null)

  if (!accessToken) {
    return (
      <Button
        variant="outline"
        className="self-start"
        nativeButton={false}
        render={<Link href={`/login?next=${encodeURIComponent(pathname)}`} />}
      >
        <CalendarPlusIcon aria-hidden /> Đăng nhập để thêm vào thực đơn
      </Button>
    )
  }

  function reset() {
    setStage({ kind: "choose" })
    setProblems([])
    setError(null)
  }

  function failed(cause: unknown, fallback: string) {
    if (cause instanceof ApiError && cause.status === 401) {
      router.refresh()
      return "Phiên đăng nhập đã hết hạn. Hãy thử lại sau khi trang tải lại."
    }
    return fallback
  }

  async function preview() {
    if (!accessToken) return
    setStage({ kind: "previewing" })
    setProblems([])
    setError(null)
    try {
      // Always from the server: the plan may have changed in another tab.
      const plan = await fetchMealPlan([MEAL_PLAN_KEY, accessToken])
      const next = dayWithRecipe(plan, day, section, recipe.id)
      if (!next.input) {
        setError(next.error)
        setStage({ kind: "choose" })
        return
      }
      const days = [next.input]
      const result = await previewMealDays(accessToken, days)
      setProblems(result.problems)
      setStage({ kind: "preview", days, preview: result })
    } catch (cause) {
      setError(failed(cause, "Không xem trước được thực đơn. Thử lại nhé."))
      setStage({ kind: "choose" })
    }
  }

  async function apply() {
    if (!accessToken || stage.kind !== "preview") return
    setStage({ ...stage, kind: "saving" })
    setError(null)
    try {
      const saved = await saveMealDays(accessToken, stage.days)
      await mutate([MEAL_PLAN_KEY, accessToken], saved, { revalidate: false })
      setStage({ kind: "saved" })
    } catch (cause) {
      const invalid =
        cause instanceof ApiError && cause.status === 409
          ? mealPlanInvalidSchema.safeParse(cause.body)
          : null
      if (invalid?.success) {
        setProblems(invalid.data.problems)
        setError("Thực đơn hoặc hồ sơ ăn uống vừa thay đổi. Xem lại các vấn đề bên dưới.")
      } else {
        setError(failed(cause, "Không lưu được thực đơn. Thử lại nhé."))
      }
      setStage({ ...stage, kind: "preview" })
    }
  }

  if (stage.kind === "saved") {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 p-3">
        <CheckIcon aria-hidden className="size-4 text-primary" />
        <span>
          Đã thêm vào {DAY_LABELS[day]}, bữa {SECTION_LABELS[section].toLowerCase()}.
        </span>
        <Button variant="link" size="sm" nativeButton={false} render={<Link href={MEAL_PLANNER_PATH} />}>
          Xem thực đơn
        </Button>
      </div>
    )
  }

  const busy = stage.kind === "previewing" || stage.kind === "saving"
  const shown = stage.kind === "preview" || stage.kind === "saving" ? stage.preview : null
  const changed = shown?.days.flatMap(({ day: shownDay, sections }) =>
    sections
      .filter(({ recipes, previous }) => recipes.map(({ id }) => id).join() !== previous.map(({ id }) => id).join())
      .map((item) => ({ ...item, day: shownDay }))
  )

  return (
    <section aria-labelledby="add-to-plan-title" className="flex flex-col gap-3 rounded-2xl border border-border p-3">
      <h3 id="add-to-plan-title" className="font-semibold">
        Thêm vào thực đơn tuần
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel htmlFor="plan-day">Ngày</FieldLabel>
          <NativeSelect
            id="plan-day"
            value={day}
            disabled={busy}
            onChange={(event) => {
              setDay(event.target.value as Weekday)
              reset()
            }}
            className="w-full"
          >
            {WEEKDAYS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {DAY_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="plan-section">Bữa</FieldLabel>
          <NativeSelect
            id="plan-section"
            value={section}
            disabled={busy}
            onChange={(event) => {
              setSection(event.target.value as MealSection)
              reset()
            }}
            className="w-full"
          >
            {MEAL_SECTIONS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {SECTION_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {changed && changed.length > 0 && (
        <div aria-live="polite" className="rounded-xl bg-muted/60 p-3">
          <p className="font-medium">Xem trước, chưa lưu</p>
          <ul className="mt-1 space-y-1">
            {changed.map((item) => (
              <li key={`${item.day}-${item.section}`}>
                {DAY_LABELS[item.day]}, bữa {SECTION_LABELS[item.section].toLowerCase()}:{" "}
                {item.recipes.map(({ title }) => title).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-destructive">
          {problems.map((problem, index) => (
            <li key={index}>{problemText(problem)}</li>
          ))}
        </ul>
      )}
      {error && <FieldError>{error}</FieldError>}

      <div className="flex flex-wrap gap-2">
        {shown ? (
          <>
            <Button onClick={() => void apply()} disabled={busy || problems.length > 0}>
              {stage.kind === "saving" && <Spinner aria-hidden />}
              Áp dụng
            </Button>
            <Button variant="outline" onClick={reset} disabled={busy}>
              Hủy
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => void preview()} disabled={busy}>
            {stage.kind === "previewing" ? <Spinner aria-hidden /> : <CalendarPlusIcon aria-hidden />}
            Xem trước
          </Button>
        )}
      </div>
    </section>
  )
}
