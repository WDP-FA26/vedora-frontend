import type { MealPlan, MealSection, Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"

export const DAY_LABELS: Record<Weekday, string> = {
  MON: "Thứ Hai",
  TUE: "Thứ Ba",
  WED: "Thứ Tư",
  THU: "Thứ Năm",
  FRI: "Thứ Sáu",
  SAT: "Thứ Bảy",
  SUN: "Chủ nhật",
}

export const DAY_SHORT: Record<Weekday, string> = {
  MON: "T2",
  TUE: "T3",
  WED: "T4",
  THU: "T5",
  FRI: "T6",
  SAT: "T7",
  SUN: "CN",
}

export const SECTION_LABELS: Record<MealSection, string> = {
  BREAKFAST: "Sáng",
  LUNCH: "Trưa",
  DINNER: "Tối",
  OTHER: "Khác",
}

export function formatDayMonth(date: string) {
  const [, month, day] = date.split("-")
  return `${Number(day)}/${Number(month)}`
}

export function dayOfMonth(date: string) {
  return Number(date.split("-")[2])
}

export function weekRangeLabel(plan: MealPlan) {
  const first = plan.days[0]
  const last = plan.days[plan.days.length - 1]
  if (!first || !last) return ""
  return `${formatDayMonth(first.date)} – ${formatDayMonth(last.date)}/${last.date.split("-")[0]}`
}

function shiftDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function weekStartRangeLabel(weekStart: string) {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(shiftDays(weekStart, 6))}`
}

export function shiftWeek(weekStart: string, weeks: number) {
  const [year, month, day] = weekStart.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + weeks * 7))
  return shifted.toISOString().slice(0, 10)
}

export function todayOf(plan: MealPlan): Weekday | undefined {
  return plan.days.find(({ date }) => date === plan.today)?.day
}

export function editableDaysOf(plan: MealPlan): Weekday[] {
  return plan.days.filter(({ editable }) => editable).map(({ day }) => day)
}

export function isDayEditable(plan: MealPlan, day: Weekday) {
  return plan.days.find((item) => item.day === day)?.editable ?? false
}
