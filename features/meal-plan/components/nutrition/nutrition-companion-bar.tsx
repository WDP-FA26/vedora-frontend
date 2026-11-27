"use client"

import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react"
import {
  ActivityIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ScaleIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AsianBmiSpectrumBar,
  NutritionProfileForm,
  WeightBmiTrendChart,
  WeightQuickCheckIn,
} from "@/features/dietary/components/bmi-charts"
import {
  BMI_CATEGORY_META,
  NUTRITION_GOAL_LABELS,
  NUTRITION_PILLARS,
  NUTRITION_PILLAR_META,
  type DietaryMemory,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { InlineDietaryEditor } from "@/features/meal-plan/components/nutrition/inline-dietary-editor"
import { WeeklyCalorieBarChart } from "@/features/meal-plan/components/nutrition/weekly-calorie-chart"
import { DAY_LABELS } from "@/features/meal-plan/lib/dates"
import { computeWeekNutrition } from "@/features/meal-plan/lib/nutrition"
import {
  readScrollState,
  scrollContainer,
  type ScreenScrollDirection,
  type VoiceScrollState,
} from "@/features/meal-plan/lib/scroll"
import type { MealLogWeek } from "@/features/meal-plan/schemas/meal-log.schema"
import type { MealPlan } from "@/features/meal-plan/schemas/meal-plan.schema"
import type { BodyMetricsTab } from "@/features/meal-plan/voice/voice-stream"
import { cn } from "@/lib/utils"

function buildBalancePrompt(
  plan: MealPlan,
  nutrition: NutritionProfile | undefined,
): string {
  const weekSummary = computeWeekNutrition(plan, nutrition)
  if (weekSummary.plannedDayCount === 0) {
    return "Hãy gợi ý cho mình thực đơn chay cả tuần cân đối theo chỉ số BMI và đủ 5 nhóm dưỡng chất chay nhé."
  }
  const missingNames = weekSummary.missingPillars.map(
    (pillar) => NUTRITION_PILLAR_META[pillar].label.toLowerCase(),
  )
  if (missingNames.length > 0) {
    return `Nhờ trợ lý xem lại thực đơn tuần này giúp mình: mình muốn cân đối theo mục tiêu cân nặng và bổ sung thêm nhóm ${missingNames.join(", ")} nhé.`
  }
  return "Nhờ trợ lý nhận xét thực đơn tuần này xem lượng calo ước tính và 5 nhóm chất chay (Đạm, Xơ, Sắt, Canxi, Béo tốt) đã hài hòa với BMI của mình chưa?"
}

export type NutritionCompanionBarHandle = {
  showBodyMetrics: (tab?: BodyMetricsTab) => void
  showDietary: () => void
  hideBodyMetrics: () => void
  scrollBodyMetrics: (direction: ScreenScrollDirection) => void
  isBodyMetricsOpen: () => boolean
  bodyMetricsTab: () => BodyMetricsTab
  bodyMetricsScrollState: () => VoiceScrollState | undefined
}

export function NutritionCompanionBar({
  plan,
  nutrition,
  mealLog,
  dietary,
  onNutritionSaved,
  onDietarySaved,
  onAskAssistant,
  trailing,
  handle,
}: {
  plan: MealPlan
  nutrition: NutritionProfile | undefined
  mealLog?: MealLogWeek
  dietary?: DietaryMemory
  onNutritionSaved: (next: NutritionProfile) => Promise<void> | void
  onDietarySaved?: (next: DietaryMemory) => Promise<void> | void
  onAskAssistant?: (prompt: string) => void
  trailing?: ReactNode
  handle?: Ref<NutritionCompanionBarHandle>
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<BodyMetricsTab>("weekly")
  const [editingProfile, setEditingProfile] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(handle, () => ({
    showBodyMetrics(tab?: BodyMetricsTab) {
      setActiveTab(tab ?? "bmi")
      setSheetOpen(true)
    },
    showDietary() {
      setActiveTab("dietary")
      setSheetOpen(true)
    },
    hideBodyMetrics() {
      setSheetOpen(false)
    },
    scrollBodyMetrics(direction) {
      requestAnimationFrame(() => scrollContainer(bodyRef.current?.parentElement ?? null, direction))
    },
    isBodyMetricsOpen() {
      return sheetOpen
    },
    bodyMetricsTab() {
      return activeTab
    },
    bodyMetricsScrollState() {
      if (!sheetOpen) return undefined
      return readScrollState(bodyRef.current?.parentElement ?? null)
    },
  }))

  const weekSummary = computeWeekNutrition(plan, nutrition)
  const hasBmi = nutrition !== undefined && nutrition.bmi !== null && nutrition.bmiCategory !== null
  const goalInfo = nutrition?.effectiveGoal
    ? NUTRITION_GOAL_LABELS[nutrition.effectiveGoal]
    : null
  const daysWithHints = weekSummary.days.filter((day) => day.hints.length > 0)
  const coveredPillarCount = NUTRITION_PILLARS.length - weekSummary.missingPillars.length

  function openSheet(tab: BodyMetricsTab) {
    setActiveTab(tab)
    setSheetOpen(true)
  }

  let bmiLabel = "Thiết lập BMI & mục tiêu calo"
  if (hasBmi && nutrition.bmiCategory) {
    const parts = [`BMI ${nutrition.bmi?.toFixed(1)} (${BMI_CATEGORY_META[nutrition.bmiCategory].label})`]
    if (goalInfo && nutrition.dailyCalorieTarget) {
      parts.push(`${goalInfo.shortLabel} ~${nutrition.dailyCalorieTarget} kcal/ngày`)
    }
    bmiLabel = parts.join(" · ")
  }

  function renderBmiTabContent() {
    if (!nutrition) {
      return <p className="text-sm text-muted-foreground">Đang tải hồ sơ BMI…</p>
    }
    const profileKey = `${nutrition.heightCm}-${nutrition.weightKg}-${nutrition.birthYear}-${nutrition.biologicalSex}-${nutrition.activityLevel}-${nutrition.nutritionGoal}`
    if (!hasBmi) {
      return (
        <>
          <AsianBmiSpectrumBar profile={nutrition} />
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Thiết lập thông số cơ thể &amp; mục tiêu</h3>
            <NutritionProfileForm
              key={profileKey}
              profile={nutrition}
              onSaved={onNutritionSaved}
            />
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("dietary")}
            className="inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Mở Dị ứng &amp; Sở thích
          </button>
        </>
      )
    }
    return (
      <>
        <AsianBmiSpectrumBar profile={nutrition} />
        <WeightQuickCheckIn profile={nutrition} onSaved={onNutritionSaved} />
        <WeightBmiTrendChart profile={nutrition} />
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditingProfile((open) => !open)}
            >
              {editingProfile ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
              Chỉnh chỉ số cơ thể &amp; mục tiêu
            </Button>
            <button
              type="button"
              onClick={() => setActiveTab("dietary")}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Dị ứng &amp; Sở thích
            </button>
          </div>
          {editingProfile && (
            <div className="mt-3 border-t border-border pt-3">
              <NutritionProfileForm
                key={profileKey}
                profile={nutrition}
                onSaved={async (updated) => {
                  await onNutritionSaved(updated)
                  setEditingProfile(false)
                }}
              />
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/20 px-3 py-2 text-xs sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openSheet("bmi")}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium transition-colors hover:border-primary/40"
            )}
          >
            <ScaleIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="truncate tabular-nums">{bmiLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => openSheet("weekly")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium tabular-nums transition-colors",
              weekSummary.plannedDayCount === 0
                ? "border border-border bg-card text-foreground hover:border-primary/40"
                : weekSummary.missingPillars.length === 0
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
            )}
            title="Xem chi tiết 5 nhóm dưỡng chất chay và biểu đồ calo tuần"
          >
            <BarChart3Icon aria-hidden className="size-3.5 shrink-0" />
            {weekSummary.plannedDayCount > 0
              ? `${coveredPillarCount}/${NUTRITION_PILLARS.length} nhóm chất`
              : "Dinh dưỡng tuần"}
          </button>
        </div>

        {trailing && <div className="flex shrink-0 flex-wrap items-center gap-2">{trailing}</div>}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-[side=right]:w-full data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>Trợ lý Dinh dưỡng & Theo dõi BMI</SheetTitle>
            <SheetDescription>
              Mọi con số calo và BMI chỉ mang tính tham khảo tương đối để giúp bạn ăn chay đủ chất và nhẹ nhàng hơn.
            </SheetDescription>
          </SheetHeader>

          <div ref={bodyRef} className="px-6 pb-6">
            <Tabs
              value={activeTab}
              onValueChange={(next) => setActiveTab(next as BodyMetricsTab)}
            >
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="weekly">
                  <BarChart3Icon aria-hidden /> Theo tuần
                </TabsTrigger>
                <TabsTrigger value="bmi">
                  <ActivityIcon aria-hidden /> BMI
                </TabsTrigger>
                <TabsTrigger value="dietary">
                  <ShieldAlertIcon aria-hidden /> Dị ứng &amp; Gu
                </TabsTrigger>
              </TabsList>

              <TabsContent value="weekly">
                <div className="space-y-4">
                  <WeeklyCalorieBarChart plan={plan} nutrition={nutrition} mealLog={mealLog} />

                  {onAskAssistant &&
                    mealLog &&
                    mealLog.summary.completeDays > 0 &&
                    mealLog.summary.remainingDays > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSheetOpen(false)
                          onAskAssistant(
                            "Xem nhật ký ăn uống tuần này so với kế hoạch và mục tiêu của mình, rồi cân bằng nhẹ nhàng các ngày còn lại trong tuần nhé (hỏi mình trước khi chỉnh)."
                          )
                        }}
                      >
                        <SparklesIcon aria-hidden />
                        Cân bằng phần còn lại của tuần theo thực tế đã ăn
                      </Button>
                    )}

                  <div className="space-y-2.5 rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">Đĩa dinh dưỡng chay tuần này</h3>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {weekSummary.plannedDayCount} ngày có món
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {NUTRITION_PILLARS.map((pillar) => {
                        const count = weekSummary.pillarCounts[pillar]
                        const meta = NUTRITION_PILLAR_META[pillar]
                        const pct =
                          weekSummary.plannedDayCount > 0
                            ? Math.round((count / weekSummary.plannedDayCount) * 100)
                            : 0
                        return (
                          <div key={pillar} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">{meta.label}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {count}/{weekSummary.plannedDayCount} ngày
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-[width]",
                                  count > 0 ? "bg-primary" : "bg-transparent"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[0.6875rem] text-muted-foreground">{meta.tip}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {daysWithHints.length > 0 ? (
                    <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                      <h3 className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                        <TriangleAlertIcon aria-hidden className="size-4" />
                        Gợi ý cân bằng nhẹ nhàng
                      </h3>
                      <ul className="space-y-1.5 text-amber-900/90 dark:text-amber-200/90">
                        {daysWithHints.map((item) => (
                          <li key={item.day}>
                            <span className="font-semibold">{DAY_LABELS[item.day]}:</span>{" "}
                            {item.hints.join(" ")}
                          </li>
                        ))}
                      </ul>
                      {onAskAssistant && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-1"
                          onClick={() => {
                            setSheetOpen(false)
                            onAskAssistant(buildBalancePrompt(plan, nutrition))
                          }}
                        >
                          <SparklesIcon aria-hidden />
                          Nhờ trợ lý điều chỉnh tuần này
                        </Button>
                      )}
                    </div>
                  ) : weekSummary.plannedDayCount > 0 ? (
                    <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2Icon aria-hidden className="size-4 shrink-0" />
                      Các ngày đã xếp đầy đủ bữa hiện đang khá hài hòa với mục tiêu của bạn.
                    </p>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="bmi">
                <div className="space-y-4">{renderBmiTabContent()}</div>
              </TabsContent>

              <TabsContent value="dietary">
                <InlineDietaryEditor
                  key={
                    dietary
                      ? `${dietary.allergies.join("|")}::${dietary.preferences.join("|")}`
                      : "loading"
                  }
                  dietary={dietary}
                  onSaved={onDietarySaved}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
