import {
  MEAL_SECTIONS,
  WEEKDAYS,
  type MealDayInput,
  type MealPlan,
  type MealPlanProposal,
  type MealRecipe,
  type MealSection,
  type SlotChange,
  type SlotRef,
  type Weekday,
} from "@/features/meal-plan/schemas/meal-plan.schema"

export type RecipeRef = Pick<MealRecipe, "id" | "title" | "tag">
export type DisplayRecipe = RecipeRef & { detail?: MealRecipe }
export type DisplayDay = {
  day: Weekday
  sections: { section: MealSection; recipes: DisplayRecipe[] }[]
}

export function recipeTime(recipe: MealRecipe | undefined) {
  if (!recipe || (recipe.prepMinutes === null && recipe.cookMinutes === null)) return null
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
}

export function recipesAt(plan: MealPlan, { day, section }: SlotRef): MealRecipe[] {
  const planned = plan.days.find((item) => item.day === day)
  return planned?.sections.find((item) => item.section === section)?.recipes ?? []
}

export function toDayInputs(proposal: MealPlanProposal): MealDayInput[] {
  return proposal.days.map(({ day, sections }) => {
    const ids = (section: MealSection) =>
      sections.find((item) => item.section === section)?.recipes.map(({ id }) => id) ?? []
    return {
      day,
      breakfast: ids("BREAKFAST"),
      lunch: ids("LUNCH"),
      dinner: ids("DINNER"),
      others: ids("OTHER"),
    }
  })
}

export function inputsForChanges(plan: MealPlan, changes: SlotChange[]): MealDayInput[] {
  const days = WEEKDAYS.filter((day) => changes.some((change) => change.day === day))
  return days.map((day) => {
    const ids = (section: MealSection) => {
      const change = changes.find((item) => item.day === day && item.section === section)
      if (change) return change.recipeIds
      return recipesAt(plan, { day, section }).map(({ id }) => id)
    }
    return {
      day,
      breakfast: ids("BREAKFAST"),
      lunch: ids("LUNCH"),
      dinner: ids("DINNER"),
      others: ids("OTHER"),
    }
  })
}

export function planAfterChanges(plan: MealPlan, changes: SlotChange[]): MealPlan | null {
  const known = new Map<string, MealRecipe>()
  for (const day of plan.days) {
    for (const section of day.sections) {
      for (const recipe of section.recipes) known.set(recipe.id, recipe)
    }
  }

  const days = plan.days.map((planned) => {
    const sections = MEAL_SECTIONS.map((section) => ({
      section,
      recipes: recipesAt(plan, { day: planned.day, section }),
    }))
    return { ...planned, sections }
  })

  for (const change of changes) {
    const recipes: MealRecipe[] = []
    for (const id of change.recipeIds) {
      const recipe = known.get(id)
      if (!recipe) return null
      recipes.push(recipe)
    }
    const day = days.find((item) => item.day === change.day)
    const section = day?.sections.find((item) => item.section === change.section)
    if (!section) return null
    section.recipes = recipes
  }
  return { ...plan, days }
}

export function displayDays(
  plan: MealPlan | undefined,
  draft: MealPlanProposal | null | undefined
): DisplayDay[] {
  const savedRecipes = new Map<string, MealRecipe>()
  for (const day of plan?.days ?? []) {
    for (const section of day.sections) {
      for (const recipe of section.recipes) savedRecipes.set(recipe.id, recipe)
    }
  }

  const merged = new Map<Weekday, Map<MealSection, RecipeRef[]>>()
  for (const day of plan?.days ?? []) {
    merged.set(day.day, new Map(day.sections.map(({ section, recipes }) => [section, recipes])))
  }
  for (const day of draft?.days ?? []) {
    const sections = merged.get(day.day) ?? new Map<MealSection, RecipeRef[]>()
    for (const proposal of day.sections) {
      const changed =
        proposal.recipes.map(({ id }) => id).join() !== proposal.previous.map(({ id }) => id).join()
      if (changed || !plan) sections.set(proposal.section, proposal.recipes)
    }
    merged.set(day.day, sections)
  }

  return WEEKDAYS.filter((day) => merged.has(day)).map((day) => ({
    day,
    sections: [...(merged.get(day)?.entries() ?? [])].map(([section, recipes]) => ({
      section,
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        tag: recipe.tag,
        detail: savedRecipes.get(recipe.id),
      })),
    })),
  }))
}
