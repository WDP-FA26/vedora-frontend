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
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { todayWeekday } from "@/features/meal-plan/components/timetable";
import {
  DAY_LABELS,
  MAX_GENERATE_QUERY_LENGTH,
  MEAL_SECTIONS,
  SECTION_LABELS,
  WEEKDAYS,
  type GenerateRequest,
  type MealSection,
} from "@/features/meal-plan/meal-plan";

const SCOPES = [
  { id: "EMPTY", label: "Các bữa trống" },
  { id: "WEEK", label: "Cả tuần" },
  { id: "TODAY", label: "Hôm nay" },
] as const;
type Scope = (typeof SCOPES)[number]["id"];

const MINUTE_OPTIONS = [15, 30, 60] as const;

function requestFor(
  scope: Scope,
  sections: MealSection[],
  maxMinutes: number | null,
  query: string,
): GenerateRequest {
  const request: GenerateRequest = {
    days: scope === "TODAY" ? [todayWeekday()] : [...WEEKDAYS],
    sections,
    onlyEmpty: scope === "EMPTY",
  };
  if (maxMinutes !== null) request.maxMinutes = maxMinutes;
  if (query) request.query = query;
  return request;
}

const MAX_INSTRUCTION_LENGTH = 500;

function assistantPrompt(request: GenerateRequest, instruction: string) {
  const lines = [
    `Yêu cầu của tôi: ${instruction}`,
    "Yêu cầu trên là điều quan trọng nhất: nếu nó nhắc ngày, bữa hay món cụ thể thì làm đúng như vậy, kể cả thay món đã có ở ô đó. Phần còn lại dùng các lựa chọn mặc định dưới đây.",
    `Ngày mặc định: ${request.days.map((day) => DAY_LABELS[day]).join(", ")}.`,
    `Các bữa mặc định: ${request.sections.map((section) => SECTION_LABELS[section].toLowerCase()).join(", ")}.`,
    request.onlyEmpty ? "Mặc định chỉ điền các ô đang trống, giữ nguyên món đã có." : "Mặc định có thể thay món ở các ô này.",
  ]
  if (request.maxMinutes !== undefined) lines.push(`Mỗi bữa nấu tối đa ${request.maxMinutes} phút.`)
  if (request.query) lines.push(`Ưu tiên: ${request.query}.`)
  lines.push("Hãy cho tôi xem đề xuất trước khi lưu.")
  return lines.join("\n")
}

/**
 * A floating button that opens a short form. `onGenerate` runs the algorithm and
 * resolves to an error message, or null when a suggestion is on the calendar.
 */
export function QuickGenerate({
  disabled,
  onGenerate,
  onAskAssistant,
}: {
  disabled: boolean;
  onGenerate: (request: GenerateRequest) => Promise<string | null>;
  /** Sends a written request to the assistant, which can use the same algorithm as a tool. */
  onAskAssistant: (prompt: string) => void;
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
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    if (pending) return;
    if (meals.length === 0) {
      setError("Chọn ít nhất một bữa.");
      return;
    }
    const request = requestFor(scope, meals, maxMinutes, query.trim());
    const wish = instruction.trim();
    if (wish) {
      onAskAssistant(assistantPrompt(request, wish));
      setOpen(false);
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
      <Button
        type="button"
        variant="raised"
        size="icon-fab"
        shape="pill"
        disabled={disabled}
        aria-label="Lên món nhanh"
        title="Lên món nhanh"
        className="fixed right-5 bottom-5 z-30"
        onClick={() => setOpen(true)}
      >
        <SparklesIcon aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <form
            onSubmit={submit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <SheetHeader>
              <SheetTitle>Lên món nhanh</SheetTitle>
              <SheetDescription>
                Chọn món tự động theo hồ sơ ăn uống của bạn. Kết quả hiện trên
                lịch, chưa có gì được lưu.
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
                    {SCOPES.map(({ id, label }) => (
                      <Button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={scope === id}
                        variant={scope === id ? "default" : "outline"}
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

                <Field>
                  <FieldLabel htmlFor="quick-instruction">
                    Yêu cầu riêng cho trợ lý
                  </FieldLabel>
                  <Textarea
                    id="quick-instruction"
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    maxLength={MAX_INSTRUCTION_LENGTH}
                    rows={3}
                    placeholder="Ví dụ: bữa tối nhẹ, cuối tuần nấu cầu kỳ hơn, tránh món chiên"
                  />
                  <FieldDescription>
                    Để trống thì chọn ngay bằng thuật toán. Có nội dung thì trợ
                    lý đọc yêu cầu, chọn món rồi chỉnh theo ý bạn.
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
                {instruction.trim() ? "Nhờ trợ lý" : "Chọn món"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
