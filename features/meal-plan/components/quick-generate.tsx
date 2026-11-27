"use client";

import { useState, type FormEvent } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  editableDaysOf,
  MAX_GENERATE_QUERY_LENGTH,
  MEAL_SECTIONS,
  SECTION_LABELS,
  todayOf,
  type GenerateInput,
  type MealPlan,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan";

const SCOPES = [
  { id: "EMPTY", label: "Các bữa trống" },
  { id: "WEEK", label: "Cả tuần" },
  { id: "TODAY", label: "Hôm nay" },
] as const;
type Scope = (typeof SCOPES)[number]["id"];

const MINUTE_OPTIONS = [15, 30, 60] as const;

/** Days a request may cover: today only when it is in this week, otherwise every day that has not passed. */
function daysFor(scope: Scope, plan: MealPlan): Weekday[] {
  if (scope !== "TODAY") return editableDaysOf(plan);
  const today = todayOf(plan);
  return today ? [today] : [];
}

function requestFor(
  plan: MealPlan,
  scope: Scope,
  sections: MealSection[],
  maxMinutes: number | null,
  query: string,
): GenerateInput {
  const request: GenerateInput = {
    days: daysFor(scope, plan),
    sections,
    onlyEmpty: scope === "EMPTY",
  };
  if (maxMinutes !== null) request.maxMinutes = maxMinutes;
  if (query) request.query = query;
  return request;
}

/**
 * Opens a short form that runs the non-AI meal-plan algorithm (0 AI quota)
 * and saves the picked dishes directly into the chosen slots.
 */
export function QuickGenerate({
  plan,
  disabled,
  variant = "toolbar",
  onGenerate,
}: {
  /** The week on screen; nothing can be generated until it has loaded. */
  plan: MealPlan | undefined
  disabled: boolean
  variant?: "toolbar" | "fab"
  onGenerate: (request: GenerateInput) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("EMPTY");
  const [meals, setMeals] = useState<MealSection[]>([
    "BREAKFAST",
    "LUNCH",
    "DINNER",
  ]);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // "Hôm nay" only makes sense in the week that holds today.
  const scopes = SCOPES.filter(({ id }) => id !== "TODAY" || (plan !== undefined && todayOf(plan) !== undefined));
  const activeScope: Scope = scopes.some(({ id }) => id === scope) ? scope : "EMPTY";

  function toggleMeal(meal: MealSection, checked: boolean) {
    setError("");
    if (checked) {
      setMeals([...meals, meal]);
      return;
    }
    setMeals(meals.filter((item) => item !== meal));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !plan) return;
    if (meals.length === 0) {
      setError("Chọn ít nhất một bữa.");
      return;
    }
    const request = requestFor(plan, activeScope, meals, maxMinutes, query.trim());
    if (request.days.length === 0) {
      setError("Các ngày của tuần này đã qua nên không thể lên thực đơn.");
      return;
    }
    setPending(true);
    setError("");
    const failure = await onGenerate(request);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      {variant === "fab" ? (
        <Button
          type="button"
          variant="raised"
          size="icon-fab"
          shape="pill"
          disabled={disabled || !plan?.editable}
          aria-label="Lên món nhanh"
          title="Lên món nhanh"
          className="fixed right-5 bottom-5 z-30"
          onClick={() => setOpen(true)}
        >
          <SparklesIcon aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !plan?.editable}
          title="Tự động điền món theo hồ sơ ăn uống, không tốn lượt AI"
          onClick={() => setOpen(true)}
        >
          <SparklesIcon aria-hidden />
          Lên nhanh
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        >
          <form
            onSubmit={submit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <SheetHeader>
              <SheetTitle>Lên món nhanh</SheetTitle>
              <SheetDescription>
                Chọn món tự động theo hồ sơ ăn uống (không tốn lượt AI) và lưu
                ngay vào các ô bạn chọn.
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FieldGroup>
                <FieldSet>
                  <FieldLegend variant="label">Phạm vi</FieldLegend>
                  <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Phạm vi"
                  >
                    {scopes.map(({ id, label }) => (
                      <Button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={activeScope === id}
                        variant={activeScope === id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setScope(id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Các bữa</FieldLegend>
                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_SECTIONS.map((meal) => (
                      <Field key={meal} orientation="horizontal">
                        <Checkbox
                          id={`quick-meal-${meal}`}
                          checked={meals.includes(meal)}
                          onCheckedChange={(checked) =>
                            toggleMeal(meal, checked)
                          }
                        />
                        <FieldLabel htmlFor={`quick-meal-${meal}`}>
                          {SECTION_LABELS[meal]}
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">
                    Thời gian nấu mỗi bữa
                  </FieldLegend>
                  <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Thời gian nấu mỗi bữa"
                  >
                    <Button
                      type="button"
                      role="radio"
                      aria-checked={maxMinutes === null}
                      variant={maxMinutes === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMaxMinutes(null)}
                    >
                      Tùy ý
                    </Button>
                    {MINUTE_OPTIONS.map((minutes) => (
                      <Button
                        key={minutes}
                        type="button"
                        role="radio"
                        aria-checked={maxMinutes === minutes}
                        variant={maxMinutes === minutes ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMaxMinutes(minutes)}
                      >
                        ≤ {minutes} phút
                      </Button>
                    ))}
                  </div>
                </FieldSet>

                <Field>
                  <FieldLabel htmlFor="quick-query">
                    Món hoặc nguyên liệu muốn ưu tiên
                  </FieldLabel>
                  <Input
                    id="quick-query"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={MAX_GENERATE_QUERY_LENGTH}
                    autoComplete="off"
                    placeholder="Ví dụ: đậu hũ"
                  />
                  <FieldDescription>
                    Chỉ ưu tiên, không bắt buộc mọi bữa đều có.
                  </FieldDescription>
                </Field>

                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
            </div>

            <SheetFooter>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Spinner aria-hidden />
                ) : (
                  <SparklesIcon aria-hidden />
                )}{" "}
                Chọn &amp; lưu ngay
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
