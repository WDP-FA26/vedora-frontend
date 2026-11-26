"use client"

import { useState } from "react"
import { SearchIcon, UsersIcon, UtensilsCrossedIcon, UtensilsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard } from "@/features/home/components/post-card"
import { PostSearchForm } from "@/features/posts/components/post-search-form"
import { usePostSearch } from "@/features/posts/hooks/use-post-search"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import {
  isSearchTab,
  SEARCH_TABS,
  type SearchTab,
} from "@/features/posts/posts-cache"
import { ProfileSearchRow } from "@/features/profiles/components/profile-search-row"
import { useProfileSearch } from "@/features/profiles/hooks/use-profile-search"
import { RecipeCard, RecipeDialog } from "@/features/recipes/components/recipe-card"
import { useRecipeSearch } from "@/features/recipes/hooks/use-recipe-catalog"
import { MenuDishSearchRow } from "@/features/workspaces/components/menu-dish-search-row"
import { useMenuSearch } from "@/features/workspaces/hooks/use-menu-search"

const TAB_LABELS: Record<SearchTab, string> = {
  all: "Tất cả",
  people: "Mọi người",
  recipes: "Công thức",
  dishes: "Món nhà hàng",
  posts: "Bài viết",
}

const TOP_PEOPLE_LIMIT = 3
const TOP_RECIPES_LIMIT = 2
const TOP_DISHES_LIMIT = 4

function buildSearchRedirect(q: string, tab: SearchTab) {
  const params = new URLSearchParams({ q })
  if (tab !== "all") params.set("tab", tab)
  return `/home/search?${params}`
}

/** Searches people (Qdrant BM25), catalog recipes, restaurant dishes and posts, with Facebook/X-style tabs and inline Follow. */
export function SearchView({ q, initialTab }: { q: string; initialTab: SearchTab }) {
  const [tab, setTab] = useState(initialTab)
  const postsSearch = usePostSearch(q)
  const topPeople = useProfileSearch(q, TOP_PEOPLE_LIMIT)
  const allPeople = useProfileSearch(tab === "people" ? q : "", 20)
  const topRecipes = useRecipeSearch(q, TOP_RECIPES_LIMIT)
  const allRecipes = useRecipeSearch(tab === "recipes" ? q : "", 12)
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)
  const topDishes = useMenuSearch(q, TOP_DISHES_LIMIT)
  const allDishes = useMenuSearch(tab === "dishes" ? q : "", 15)

  function selectTab(next: SearchTab) {
    setTab(next)
    if (!q) return
    window.history.replaceState(null, "", buildSearchRedirect(q, next))
  }

  const redirectTo = q ? buildSearchRedirect(q, tab) : "/home/search"

  return (
    <section aria-labelledby="search-title">
      <Tabs value={tab} onValueChange={(next) => isSearchTab(next) && selectTab(next)}>
        <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md">
          <div className="px-4 py-2 sm:px-5">
            <h1 id="search-title" className="sr-only">
              {q ? `Kết quả tìm kiếm cho “${q}”` : "Tìm kiếm"}
            </h1>
            <PostSearchForm defaultValue={q} autoFocus={!q} tab={tab} />
          </div>
          {q && (
            <TabsList variant="timeline" aria-label="Loại kết quả tìm kiếm">
              {SEARCH_TABS.map((id) => (
                <TabsTrigger key={id} value={id}>
                  {TAB_LABELS[id]}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
        </header>

        {!q ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Tìm kiếm trên Vedora</EmptyTitle>
              <EmptyDescription>
                Gõ tên, @username, hoặc tên món chay, nguyên liệu, mẹo nấu. Có thể gõ không dấu.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <TabsContent value="all">
              <AllResultsTab
                topPeople={topPeople}
                topRecipes={topRecipes}
                topDishes={topDishes}
                postsSearch={postsSearch}
                redirectTo={redirectTo}
                onShowAllPeople={() => selectTab("people")}
                onShowAllRecipes={() => selectTab("recipes")}
                onOpenRecipe={setOpenRecipeId}
                onShowAllDishes={() => selectTab("dishes")}
              />
            </TabsContent>

            <TabsContent value="people">
              <PeopleResultsTab people={allPeople} redirectTo={redirectTo} />
            </TabsContent>

            <TabsContent value="recipes">
              <RecipesResultsTab recipes={allRecipes} onOpenRecipe={setOpenRecipeId} />
            </TabsContent>

            <TabsContent value="dishes">
              <DishesResultsTab dishes={allDishes} />
            </TabsContent>

            <TabsContent value="posts">
              <PostsResultsTab postsSearch={postsSearch} />
            </TabsContent>
          </>
        )}
      </Tabs>
      <RecipeDialog id={openRecipeId} onClose={() => setOpenRecipeId(null)} />
    </section>
  )
}

function AllResultsTab({
  topPeople,
  topRecipes,
  topDishes,
  postsSearch,
  redirectTo,
  onShowAllPeople,
  onShowAllRecipes,
  onOpenRecipe,
  onShowAllDishes,
}: {
  topPeople: ReturnType<typeof useProfileSearch>
  topRecipes: ReturnType<typeof useRecipeSearch>
  topDishes: ReturnType<typeof useMenuSearch>
  postsSearch: ReturnType<typeof usePostSearch>
  redirectTo: string
  onShowAllPeople: () => void
  onShowAllRecipes: () => void
  onOpenRecipe: (id: string) => void
  onShowAllDishes: () => void
}) {
  const isInitialLoading =
    topPeople.isLoading && topRecipes.isLoading && topDishes.isLoading && postsSearch.isLoading
  if (isInitialLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tìm kiếm" />
      </div>
    )
  }

  const noPeople = !topPeople.isLoading && !topPeople.error && topPeople.profiles.length === 0
  const noRecipes = !topRecipes.isLoading && !topRecipes.error && topRecipes.recipes.length === 0
  const noDishes = !topDishes.isLoading && !topDishes.error && topDishes.items.length === 0
  const noPosts = !postsSearch.isLoading && !postsSearch.error && postsSearch.posts.length === 0
  if (noPeople && noRecipes && noDishes && noPosts) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Không có kết quả phù hợp</EmptyTitle>
          <EmptyDescription>
            Thử từ khóa khác, ngắn hơn, hoặc tìm theo tên và @username.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const hasSectionAbovePosts =
    topPeople.profiles.length > 0 || topRecipes.recipes.length > 0 || topDishes.items.length > 0

  return (
    <div>
      {topPeople.error ? (
        <p role="alert" className="border-b border-border p-4 text-sm text-destructive sm:px-5">
          Không tìm được người dùng lúc này.
        </p>
      ) : topPeople.profiles.length > 0 ? (
        <section aria-labelledby="search-people-heading">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
            <h2 id="search-people-heading" className="text-base font-bold">
              Mọi người
            </h2>
            <Button type="button" variant="link" size="sm" onClick={onShowAllPeople}>
              Xem tất cả
            </Button>
          </div>
          <ul>
            {topPeople.profiles.map((profile) => (
              <ProfileSearchRow key={profile.id} profile={profile} redirectTo={redirectTo} />
            ))}
          </ul>
        </section>
      ) : null}

      {topRecipes.error ? (
        <p role="alert" className="border-b border-border p-4 text-sm text-destructive sm:px-5">
          Không tìm được công thức lúc này.
        </p>
      ) : topRecipes.recipes.length > 0 ? (
        <section aria-labelledby="search-recipes-heading" className="border-b border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
            <h2 id="search-recipes-heading" className="text-base font-bold">
              Công thức
            </h2>
            <Button type="button" variant="link" size="sm" onClick={onShowAllRecipes}>
              Xem tất cả
            </Button>
          </div>
          <RecipeGrid recipes={topRecipes.recipes} onOpenRecipe={onOpenRecipe} />
        </section>
      ) : null}

      {topDishes.error ? (
        <p role="alert" className="border-b border-border p-4 text-sm text-destructive sm:px-5">
          Không tìm được món nhà hàng lúc này.
        </p>
      ) : topDishes.items.length > 0 ? (
        <section aria-labelledby="search-dishes-heading">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
            <h2 id="search-dishes-heading" className="text-base font-bold">
              Món nhà hàng
            </h2>
            <Button type="button" variant="link" size="sm" onClick={onShowAllDishes}>
              Xem tất cả
            </Button>
          </div>
          <ul>
            {topDishes.items.map((item) => (
              <MenuDishSearchRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}

      {postsSearch.isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tìm bài viết" />
        </div>
      ) : postsSearch.error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tìm được bài viết lúc này. Thử lại sau ít phút nhé.
        </p>
      ) : postsSearch.posts.length > 0 ? (
        <section aria-labelledby="search-posts-heading">
          {hasSectionAbovePosts && (
            <h2
              id="search-posts-heading"
              className="border-b border-border px-4 py-2.5 text-base font-bold sm:px-5"
            >
              Bài viết
            </h2>
          )}
          <PostsList postsSearch={postsSearch} />
        </section>
      ) : null}
    </div>
  )
}

function PeopleResultsTab({
  people,
  redirectTo,
}: {
  people: ReturnType<typeof useProfileSearch>
  redirectTo: string
}) {
  if (people.isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tìm mọi người" />
      </div>
    )
  }
  if (people.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tìm được người dùng lúc này. Thử lại sau ít phút nhé.
      </p>
    )
  }
  if (people.profiles.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Không có người dùng phù hợp</EmptyTitle>
          <EmptyDescription>
            Thử tìm bằng tên hiển thị, @username hoặc từ khóa khác.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <ul>
        {people.profiles.map((profile) => (
          <ProfileSearchRow key={profile.id} profile={profile} redirectTo={redirectTo} />
        ))}
      </ul>
      {people.hasMore && (
        <div className="flex justify-center p-4">
          <Button type="button" variant="outline" disabled={people.isLoadingMore} onClick={people.loadMore}>
            {people.isLoadingMore && <Spinner aria-hidden />}
            Xem thêm kết quả
          </Button>
        </div>
      )}
    </>
  )
}

function RecipesResultsTab({
  recipes,
  onOpenRecipe,
}: {
  recipes: ReturnType<typeof useRecipeSearch>
  onOpenRecipe: (id: string) => void
}) {
  if (recipes.isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tìm công thức" />
      </div>
    )
  }
  if (recipes.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tìm được công thức lúc này. Thử lại sau ít phút nhé.
      </p>
    )
  }
  if (recipes.recipes.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UtensilsCrossedIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Không có công thức phù hợp</EmptyTitle>
          <EmptyDescription>
            Thử tên món hoặc tên một nguyên liệu, gõ có dấu (ví dụ “phở”, “đậu hũ”).
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <RecipeGrid recipes={recipes.recipes} onOpenRecipe={onOpenRecipe} />
      {recipes.hasMore && (
        <div className="flex justify-center p-4">
          <Button type="button" variant="outline" disabled={recipes.isLoadingMore} onClick={recipes.loadMore}>
            {recipes.isLoadingMore && <Spinner aria-hidden />}
            Xem thêm kết quả
          </Button>
        </div>
      )}
    </>
  )
}

function RecipeGrid({
  recipes,
  onOpenRecipe,
}: {
  recipes: ReturnType<typeof useRecipeSearch>["recipes"]
  onOpenRecipe: (id: string) => void
}) {
  return (
    <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <RecipeCard recipe={recipe} onOpen={() => onOpenRecipe(recipe.id)} />
        </li>
      ))}
    </ul>
  )
}

function DishesResultsTab({ dishes }: { dishes: ReturnType<typeof useMenuSearch> }) {
  if (dishes.isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tìm món nhà hàng" />
      </div>
    )
  }
  if (dishes.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tìm được món nhà hàng lúc này. Thử lại sau ít phút nhé.
      </p>
    )
  }
  if (dishes.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UtensilsIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Không có món nhà hàng phù hợp</EmptyTitle>
          <EmptyDescription>
            Thử tên món chay, danh mục hoặc tên nhà hàng khác (có thể gõ không dấu).
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <ul>
        {dishes.items.map((item) => (
          <MenuDishSearchRow key={item.id} item={item} />
        ))}
      </ul>
      {dishes.hasMore && (
        <div className="flex justify-center p-4">
          <Button type="button" variant="outline" disabled={dishes.isLoadingMore} onClick={dishes.loadMore}>
            {dishes.isLoadingMore && <Spinner aria-hidden />}
            Xem thêm kết quả
          </Button>
        </div>
      )}
    </>
  )
}

function PostsResultsTab({ postsSearch }: { postsSearch: ReturnType<typeof usePostSearch> }) {
  if (postsSearch.isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tìm bài viết" />
      </div>
    )
  }
  if (postsSearch.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tìm được bài viết lúc này. Thử lại sau ít phút nhé.
      </p>
    )
  }
  if (postsSearch.posts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Không có bài viết phù hợp</EmptyTitle>
          <EmptyDescription>
            Thử từ khóa khác, ngắn hơn, hoặc tên một nguyên liệu.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return <PostsList postsSearch={postsSearch} />
}

function PostsList({ postsSearch }: { postsSearch: ReturnType<typeof usePostSearch> }) {
  return (
    <>
      {postsSearch.posts.map((post) => (
        <PostCard key={post.id} post={toFeedPost(post)} />
      ))}
      {postsSearch.hasMore && (
        <div className="flex justify-center p-4">
          <Button
            type="button"
            variant="outline"
            disabled={postsSearch.isLoadingMore}
            onClick={postsSearch.loadMore}
          >
            {postsSearch.isLoadingMore && <Spinner aria-hidden />}
            Xem thêm kết quả
          </Button>
        </div>
      )}
    </>
  )
}
