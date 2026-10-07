import type { Metadata } from "next"

import { RecipeEditor } from "@/features/recipes/components/recipe-editor"

export const metadata: Metadata = {
  title: "Sửa công thức · Vedora Quản trị",
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <RecipeEditor recipeId={id} />
}
