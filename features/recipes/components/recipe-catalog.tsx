"use client"

import { useState } from "react"
import { BanIcon, BookOpenIcon, CarrotIcon } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IngredientsTable } from "@/features/recipes/components/ingredients-table"
import { RecipesTable } from "@/features/recipes/components/recipes-table"
import { RulesTable } from "@/features/recipes/components/rules-table"
import {
  isRecipeCatalogTab,
  type RecipeCatalogTab,
} from "@/features/recipes/recipes-cache"

const TABS = [
  { id: "recipes", label: "Công thức", icon: BookOpenIcon, Panel: RecipesTable },
  { id: "ingredients", label: "Nguyên liệu", icon: CarrotIcon, Panel: IngredientsTable },
  { id: "rules", label: "Kỵ nhau", icon: BanIcon, Panel: RulesTable },
] as const satisfies readonly { id: RecipeCatalogTab; [key: string]: unknown }[]

/** Recipes and everything they are built from, one tab each. */
export function RecipeCatalog({ initialTab }: { initialTab: RecipeCatalogTab }) {
  const [tab, setTab] = useState(initialTab)

  function select(next: RecipeCatalogTab) {
    setTab(next)
    // Keeps the tab across reloads without a server round trip.
    window.history.replaceState(null, "", next === "recipes" ? "?" : `?tab=${next}`)
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => isRecipeCatalogTab(next) && select(next)}
      className="min-h-0 flex-1"
    >
      <div className="overflow-x-auto px-3 pt-2">
        <TabsList>
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {TABS.map(({ id, Panel }) => (
        <TabsContent key={id} value={id} className="flex min-h-0 flex-col">
          <Panel />
        </TabsContent>
      ))}
    </Tabs>
  )
}
