import type { Metadata } from "next"

import { RecipeCatalog } from "@/features/recipes/components/recipe-catalog"
import { isRecipeCatalogTab } from "@/features/recipes/recipes-cache"

export const metadata: Metadata = {
  title: "Công thức · Vedora Quản trị",
}

export default async function AdminRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab } = await searchParams
  return <RecipeCatalog initialTab={isRecipeCatalogTab(tab) ? tab : "recipes"} />
}
