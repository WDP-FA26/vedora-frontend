"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import {
  DAY_LABELS,
  problemText,
  SECTION_LABELS,
  type MealPlan,
  type MealRecipe,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"

/**
 * The saved week: one block per day, split into breakfast, lunch, dinner and
 * "other". Dishes open their recipe; with `replace`, each also gets a button
 * that asks the assistant for another dish.
 */
export function Timetable({
  plan,
  failed,
  replace,
  busy = false,
  action,
}: {
  plan: MealPlan | undefined
  failed: boolean
  replace?: (day: Weekday, section: MealSection, title: string) => void
  /** The assistant is still answering. */
  busy?: boolean
  /** Where to go to change the timetable, e.g. a link to the assistant. */
  action?: ReactNode
}) {
  const [opened, setOpened] = useState<MealRecipe | null>(null)

  if (!plan) {
    return failed ? (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tải được thực đơn. Thử tải lại trang nhé.
      </p>
    ) : (
      <div className="flex justify-center p-4">
        <Spinner aria-label="Đang tải" />
      </div>
    )
  }

  const empty = plan.days.every(({ sections }) =>
    sections.every(({ recipes }) => recipes.length === 0)
  )
  if (empty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Chưa có thực đơn</EmptyTitle>
          <EmptyDescription>
            Trợ lý sẽ hỏi vài câu rồi đề xuất thực đơn cả tuần. Bạn xem trước và tự quyết
            định có áp dụng hay không.
          </EmptyDescription>
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {replace
            ? "Bấm vào món để xem công thức. Bấm nút đổi bên cạnh để trợ lý đề xuất món khác."
            : "Bấm vào món để xem công thức."}
        </p>
        {action}
      </div>

      {plan.problems.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>Thực đơn có chỗ cần sửa</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {plan.problems.map((problem, index) => (
                <li key={index}>
                  {DAY_LABELS[problem.day]}: {problemText(problem)}
                </li>
              ))}
            </ul>
            <p>
              Đổi một trong các món đó, hoặc xem lại{" "}
              <Link href={DIETARY_PATH} className="underline underline-offset-4">
                thực phẩm bạn không ăn
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}

      {plan.days.map(({ day, sections }) => (
        <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-2">
          <h3 id={`day-${day}`} className="text-sm font-semibold">
            {DAY_LABELS[day]}
          </h3>
          <dl className="divide-y divide-border rounded-2xl border border-border">
            {sections.map(({ section, recipes }) => (
              <div key={section} className="flex gap-3 px-3 py-1">
                <dt className="flex h-9 w-12 shrink-0 items-center text-sm text-muted-foreground">
                  {SECTION_LABELS[section]}
                </dt>
                <dd className="flex min-w-0 flex-1 flex-col">
                  {recipes.length === 0 && (
                    <span className="flex h-9 items-center text-sm text-muted-foreground">
                      Chưa có món
                    </span>
                  )}
                  {recipes.map((recipe) => (
                    <span key={recipe.id} className="flex min-h-9 items-center gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate rounded-md text-left text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => setOpened(recipe)}
                      >
                        {recipe.title}
                      </button>
                      {replace && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Đổi ${recipe.title} (${DAY_LABELS[day]}, ${SECTION_LABELS[section].toLowerCase()}) sang món khác`}
                          title="Nhờ trợ lý đổi món khác"
                          disabled={busy}
                          onClick={() => replace(day, section, recipe.title)}
                        >
                          <RefreshCwIcon aria-hidden />
                        </Button>
                      )}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        {opened && <RecipeDialogContent recipe={opened} />}
      </Dialog>
    </div>
  )
}

function RecipeDialogContent({ recipe }: { recipe: MealRecipe }) {
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
  return (
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{recipe.title}</DialogTitle>
        <DialogDescription>
          {recipe.servings} khẩu phần{minutes > 0 && ` · khoảng ${minutes} phút`}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 text-sm">
        <section className="flex flex-col gap-2">
          <h4 className="font-semibold">Nguyên liệu</h4>
          <ul className="list-disc pl-5">
            {recipe.ingredients.map(({ name, quantity, unit, note }) => (
              <li key={name}>
                {[quantity, unit].filter((part) => part !== null && part !== "").join(" ")}{" "}
                {name}
                {note && <span className="text-muted-foreground">, {note}</span>}
              </li>
            ))}
          </ul>
        </section>
        {recipe.steps.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold">Cách làm</h4>
            <ol className="list-decimal pl-5">
              {recipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </DialogContent>
  )
}
