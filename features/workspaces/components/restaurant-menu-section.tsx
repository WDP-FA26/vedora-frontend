"use client"

import Link from "next/link"
import { PencilIcon, UtensilsIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { usePublicRestaurantMenu } from "@/features/workspaces/hooks/use-restaurant-menu"
import { useMyWorkspaces } from "@/features/workspaces/hooks/use-workspaces"
import { formatPriceVnd } from "@/features/workspaces/lib/format"
import type { RestaurantMenuItem } from "@/features/workspaces/schemas"
import { workspacePath } from "@/features/workspaces/workspaces-cache"

function groupByCategory(items: RestaurantMenuItem[]) {
  const groups = new Map<string, RestaurantMenuItem[]>()
  for (const item of items) {
    const label = item.category?.trim() || "Món khác"
    const list = groups.get(label)
    if (list) list.push(item)
    else groups.set(label, [item])
  }
  return Array.from(groups.entries())
}

export function RestaurantMenuSection({
  pageUserId,
  workspaceId,
}: {
  pageUserId: string
  workspaceId: string | null
}) {
  const menu = usePublicRestaurantMenu(pageUserId)
  const { workspaces } = useMyWorkspaces()
  const canManage = Boolean(workspaceId && workspaces.some((item) => item.id === workspaceId))

  if (menu.isLoading && menu.items.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Spinner aria-label="Đang tải thực đơn" />
      </div>
    )
  }

  if (menu.error) {
    return (
      <p role="alert" className="p-5 text-sm text-destructive">
        Chưa tải được thực đơn của nhà hàng lúc này.
      </p>
    )
  }

  const sections = groupByCategory(menu.items)

  return (
    <div className="px-4 py-4 sm:px-5">
      {canManage && workspaceId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Cập nhật món ăn, giá và ảnh hiển thị cho thực khách.
          </p>
          <Button
            variant="outline"
            size="sm"
            shape="pill"
            nativeButton={false}
            render={<Link href={workspacePath(workspaceId)} />}
          >
            <PencilIcon aria-hidden />
            Quản lý thực đơn
          </Button>
        </div>
      )}

      {menu.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UtensilsIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Chưa có món ăn nào</EmptyTitle>
            <EmptyDescription>
              Nhà hàng chưa cập nhật thực đơn công khai. Hãy quay lại sau nhé.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map(([category, items]) => (
            <section key={category} aria-label={category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-heading text-base font-bold">{category}</h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map((item) => {
                  const priceLabel = formatPriceVnd(item.priceVnd)
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5"
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external R2/S3 dish photo
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="size-20 shrink-0 rounded-xl border border-border object-cover"
                        />
                      ) : (
                        <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                          <UtensilsIcon aria-hidden className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold leading-snug">{item.name}</h3>
                        <p className="mt-0.5 text-sm font-semibold text-primary">
                          {priceLabel ?? "Giá liên hệ"}
                        </p>
                        {item.description && (
                          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
