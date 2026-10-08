/** In-memory UI fixtures. These IDs are never sent to a server. */
export type PreviewMealKey = "breakfast" | "lunch" | "dinner"

export type PreviewMeal = {
  id: string
  title: string
  minutes: number
  servings: number
  locked: boolean
}

export type PreviewDay = {
  date: string
  meals: Record<PreviewMealKey, PreviewMeal>
}

export const PREVIEW_MEAL_KEYS: PreviewMealKey[] = ["breakfast", "lunch", "dinner"]

export const PREVIEW_MEAL_LABELS: Record<PreviewMealKey, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
}

const DISHES: Record<PreviewMealKey, string[]> = {
  breakfast: [
    "Bánh mì bơ và cà chua",
    "Cháo yến mạch bí đỏ",
    "Bún nấm rau củ",
    "Bánh cuốn chay",
    "Xôi đậu xanh",
    "Phở nấm",
    "Bánh mì đậu hũ",
  ],
  lunch: [
    "Cơm đậu hũ sốt cà",
    "Bún riêu chay",
    "Cơm nấm xào sả",
    "Mì rau củ",
    "Cơm cà ri rau củ",
    "Bún chả nấm",
    "Cơm đậu gà",
  ],
  dinner: [
    "Canh bí đỏ và cơm gạo lứt",
    "Lẩu nấm rau củ",
    "Miến xào nấm",
    "Súp đậu lăng",
    "Cơm rau củ nướng",
    "Bún xào đậu hũ",
    "Cháo nấm hạt sen",
  ],
}

const ALTERNATES: Record<PreviewMealKey, string[]> = {
  breakfast: ["Cháo đậu xanh", "Bánh mì nấm áp chảo"],
  lunch: ["Cơm nấm và rau luộc", "Bún đậu hũ rau thơm"],
  dinner: ["Súp bí đỏ và bánh mì", "Miến nấm rau củ"],
}

export function shiftDate(iso: string, offset: number) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function previewStartDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const iso = `${year}-${month}-${day}`
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7
  return shiftDate(iso, daysUntilMonday)
}

export function formatPreviewDate(iso: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("vi-VN", options ?? { day: "2-digit", month: "2-digit" }).format(
    new Date(`${iso}T12:00:00`)
  )
}

export function createPreviewDays(start: string, count = 7): PreviewDay[] {
  return Array.from({ length: count }, (_, index) => ({
    date: shiftDate(start, index),
    meals: {
      breakfast: {
        id: `sample-breakfast-${index}`,
        title: DISHES.breakfast[index % DISHES.breakfast.length],
        minutes: 20 + (index % 3) * 5,
        servings: 2,
        locked: false,
      },
      lunch: {
        id: `sample-lunch-${index}`,
        title: DISHES.lunch[index % DISHES.lunch.length],
        minutes: 25 + (index % 3) * 5,
        servings: 2,
        locked: false,
      },
      dinner: {
        id: `sample-dinner-${index}`,
        title: DISHES.dinner[index % DISHES.dinner.length],
        minutes: 30 + (index % 3) * 5,
        servings: 2,
        locked: false,
      },
    },
  }))
}

export function alternatePreviewMeal(meal: PreviewMeal, key: PreviewMealKey): PreviewMeal {
  const nextTitle = ALTERNATES[key].find((title) => title !== meal.title) ?? ALTERNATES[key][0]
  return {
    ...meal,
    id: `sample-alternate-${key}-${nextTitle}`,
    title: nextTitle,
    minutes: 25,
  }
}
