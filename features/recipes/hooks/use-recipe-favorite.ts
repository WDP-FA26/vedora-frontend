"use client"

import { useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSWRConfig } from "swr"

import { useLocalSWRState } from "@/features/shared/hooks/use-local-swr-state"

import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { fetchFavoritePage, setRecipeFavorite } from "@/features/recipes/lib/recipes-api"
import {
  FAVORITE_OVERRIDES_KEY,
  FAVORITES_KEY,
  favoritesKey,
} from "@/features/recipes/recipes-cache"
import { ApiError } from "@/features/shared/lib/api-client"

type Overrides = Record<string, boolean>

const NO_OVERRIDES: Overrides = {}

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Kiểm tra kết nối rồi thử lại."
  if (error.code === "FAVORITE_CONFLICT") return "Trạng thái lưu vừa thay đổi. Vui lòng thử lại."
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng thử lại."
  if (error.status === 404) return "Công thức này không còn tồn tại."
  return "Vui lòng thử lại."
}

const isFavoritesKey = (key: unknown) =>
  Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(FAVORITES_KEY)

export function useRecipeFavorite(recipe: { id: string; isFavorite: boolean }) {
  const { user, accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const pathname = usePathname()

  const overridesKey = user ? ([FAVORITE_OVERRIDES_KEY, user.id] as const) : null
  const overrides = useLocalSWRState<Overrides>(overridesKey, NO_OVERRIDES)

  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  const saved = overrides[recipe.id] ?? recipe.isFavorite

  async function toggle() {
    if (!accessToken) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (!overridesKey || inFlight.current) return

    inFlight.current = true
    setPending(true)
    try {
      const state = await setRecipeFavorite(accessToken, recipe.id, !saved)
      await mutate(
        overridesKey,
        (current: Overrides | undefined) => ({ ...current, [state.recipeId]: state.isFavorite }),
        { revalidate: false }
      )
      void mutate(isFavoritesKey)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "FAVORITE_CONFLICT") void mutate(isFavoritesKey)
        if (error.status === 401) router.refresh()
      }
      toast.add({
        title: saved ? "Không bỏ lưu được công thức" : "Không lưu được công thức",
        description: errorMessage(error),
      })
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return { saved, pending, toggle }
}

export function useFavoriteRecipes(page: number) {
  const { data, error, isLoading, mutate } = useAuthedSWR(favoritesKey(page), fetchFavoritePage, {
    keepPreviousData: true,
  })
  return { data: data ?? null, error, isLoading, retry: () => mutate() }
}
