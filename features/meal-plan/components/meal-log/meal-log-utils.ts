import { DAY_SHORT, formatDayMonth } from "@/features/meal-plan/lib/dates"
import type { ScreenScrollDirection, VoiceScrollState } from "@/features/meal-plan/lib/scroll"
import {
  MEAL_LOG_MAX_CALORIES,
  MEAL_LOG_MAX_SERVINGS,
  MEAL_LOG_MIN_SERVINGS,
  type MealLogDay,
  type MealLogWeek,
} from "@/features/meal-plan/schemas/meal-log.schema"
import type { MealPlan, MealRecipe, MealSection, Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { ApiError } from "@/features/shared/lib/api-client"

export type CustomDishPrefill = {
  name: string
  details?: string
  date?: string
}

export type MealLogHandle = {
  openDay: (date: string | null) => void
  openCustomDish: (prefill?: CustomDishPrefill) => void
  close: () => void
  scroll: (direction: ScreenScrollDirection) => void
  screen: () => { open: boolean; date: string | null; scrollState?: VoiceScrollState }
}

export function dayLabel(day: MealLogDay) {
  return `${DAY_SHORT[day.day]} ${formatDayMonth(day.date)}`
}

export function reviewPrompt(week: MealLogWeek) {
  const today = week.days.find((item) => item.date === week.today)
  const sunday = week.days[week.days.length - 1]
  if (!today || !sunday) return null
  const range =
    today.date === sunday.date
      ? `chỉ hôm nay (${dayLabel(today)})`
      : `chỉ từ hôm nay (${dayLabel(today)}) đến ${dayLabel(sunday)}`
  return `Xem nhật ký ăn uống tuần này và nhận xét ngắn so với kế hoạch và mục tiêu của mình. Nếu nên chỉnh thực đơn thì hỏi mình trước; khi chỉnh, ${range}, không đụng tuần khác.`
}

export function kcal(value: number) {
  return `${value.toLocaleString("vi-VN")} kcal`
}

export function logErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không lưu được. Hãy thử lại."
  if (error.code === "MEAL_LOG_LOCKED") return "Chỉ ghi được hôm nay và 7 ngày trước đó."
  if (error.code === "MEAL_LOG_FULL") return "Bữa này đã đủ số món tối đa."
  if (error.code === "CONFLICT") return "Món này đã có trong bữa đó; hãy sửa số phần ăn."
  if (error.code === "AI_QUOTA_EXCEEDED") return "Bạn đã dùng hết lượt AI. Hãy tự nhập kcal."
  if (error.status === 429) return "Bạn thao tác hơi nhanh, đợi một chút rồi thử lại."
  if (error.status === 503) return "AI đang bận, chưa tìm được kcal. Bạn có thể tự nhập."
  return error.message
}

export function sectionForNow(): MealSection {
  const hour = new Date().getHours()
  if (hour < 10) return "BREAKFAST"
  if (hour < 15) return "LUNCH"
  if (hour < 21) return "DINNER"
  return "OTHER"
}

export function parseCalories(text: string): number | null {
  if (!text.trim()) return null
  const value = Number(text)
  if (!Number.isInteger(value) || value < 0 || value > MEAL_LOG_MAX_CALORIES) return null
  return value
}

export function parseServings(text: string): number | null {
  const value = Number(text.replace(",", "."))
  if (!Number.isFinite(value)) return null
  if (value < MEAL_LOG_MIN_SERVINGS || value > MEAL_LOG_MAX_SERVINGS) return null
  return Math.round(value * 100) / 100
}

export function plannedRecipes(plan: MealPlan, day: Weekday, section: MealSection): MealRecipe[] {
  const planDay = plan.days.find((item) => item.day === day)
  return planDay?.sections.find((item) => item.section === section)?.recipes ?? []
}
