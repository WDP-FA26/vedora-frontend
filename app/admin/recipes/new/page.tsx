import type { Metadata } from "next"

import { RecipeEditor } from "@/features/recipes/components/recipe-editor"

export const metadata: Metadata = {
  title: "Thêm công thức · Vedora Quản trị",
}

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ postId?: string | string[] }>
}) {
  const { postId } = await searchParams
  return (
    <RecipeEditor
      postId={typeof postId === "string" && UUID.test(postId) ? postId : undefined}
    />
  )
}
