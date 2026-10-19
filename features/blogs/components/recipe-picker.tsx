"use client"

import { useEffect, useId, useState } from "react"
import useSWR from "swr"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { MAX_BLOG_RECIPES, type BlogRecipe } from "@/features/blogs/schemas"
import { catalogSearchKey, fetchCatalogPage } from "@/features/recipes/lib/catalog-api"

const SEARCH_DELAY_MS = 300

/**
 * The catalog recipes a blog links to, in the order readers see them. Recipes
 * are found in the public catalog; a blog never creates or edits one.
 */
export function RecipePicker({
  value,
  onChange,
  missingIds,
  disabled,
}: {
  value: BlogRecipe[]
  onChange: (recipes: BlogRecipe[]) => void
  /** Ids the API reported as gone from the catalog. */
  missingIds: string[]
  disabled?: boolean
}) {
  const { accessToken } = useAuth()
  const searchId = useId()
  const [query, setQuery] = useState("")
  const [searched, setSearched] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearched(query.trim()), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [query])

  const results = useSWR(
    searched ? ([catalogSearchKey(searched), accessToken] as const) : null,
    fetchCatalogPage,
    { keepPreviousData: true }
  )
  const full = value.length >= MAX_BLOG_RECIPES

  function move(index: number, by: -1 | 1) {
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ol aria-label="Món đã liên kết" className="flex flex-col gap-1.5">
          {value.map((recipe, index) => {
            const missing = missingIds.includes(recipe.id)
            return (
              <li
                key={recipe.id}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 data-missing:border-destructive/50 data-missing:bg-destructive/5"
                data-missing={missing ? "" : undefined}
              >
                <span className="w-5 text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {recipe.title}
                  {missing && (
                    <span className="ml-2 text-xs font-normal text-destructive">Không còn trong kho</span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Đưa ${recipe.title} lên trên`}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Đưa ${recipe.title} xuống dưới`}
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Bỏ liên kết ${recipe.title}`}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((item) => item.id !== recipe.id))}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            )
          })}
        </ol>
      )}

      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={searchId}
          type="search"
          aria-label="Tìm món trong kho công thức"
          value={query}
          maxLength={100}
          disabled={disabled || full}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={full ? `Đã đủ ${MAX_BLOG_RECIPES} món` : "Tìm món trong kho công thức"}
        />
      </InputGroup>

      {searched && !full && (
        <div aria-live="polite" className="text-sm">
          {results.isLoading ? (
            <Spinner aria-label="Đang tìm món" />
          ) : results.error ? (
            <p className="text-destructive">Không tìm được món. Thử lại nhé.</p>
          ) : results.data && results.data.items.length === 0 ? (
            <p className="text-muted-foreground">Không có món nào khớp “{searched}”.</p>
          ) : (
            <>
            <p className="mb-1 px-3 text-xs text-muted-foreground">
              {results.data && results.data.meta.hasNextPage
                ? `Hiện ${results.data.items.length}/${results.data.meta.totalItems} món khớp. Gõ cụ thể hơn để thu hẹp.`
                : `${results.data?.items.length ?? 0} món khớp.`}{" "}
              Tìm theo tên món, mô tả và nguyên liệu.
            </p>
            <ul aria-label="Kết quả tìm món" className="flex flex-col gap-1">
              {results.data?.items.map((recipe) => {
                const added = value.some((item) => item.id === recipe.id)
                return (
                  <li key={recipe.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5 hover:bg-muted/60">
                    <span className="min-w-0 flex-1 truncate">{recipe.title}</span>
                    {recipe.totalMinutes !== null && (
                      <span className="shrink-0 text-xs text-muted-foreground">{recipe.totalMinutes} phút</span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      shape="pill"
                      disabled={disabled || added}
                      aria-label={added ? `${recipe.title} đã được liên kết` : `Liên kết ${recipe.title}`}
                      onClick={() =>
                        onChange([...value, { id: recipe.id, title: recipe.title, imageUrl: recipe.imageUrl }])
                      }
                    >
                      {added ? "Đã thêm" : <><PlusIcon aria-hidden /> Thêm</>}
                    </Button>
                  </li>
                )
              })}
            </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
