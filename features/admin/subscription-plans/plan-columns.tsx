"use client"

import { createContext, useContext } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { money } from "@/features/billing/schema"
import type { ManagedPlan } from "./schema"

export const EditPlanContext = createContext<(plan: ManagedPlan) => void>(() => {})
const helper = createColumnHelper<DataTableFeatures, ManagedPlan>()
const count = new Intl.NumberFormat("vi-VN")

function EditPlan({ plan }: { plan: ManagedPlan }) {
  const edit = useContext(EditPlanContext)
  return <Button variant="outline" size="sm" aria-label={`Chỉnh sửa gói ${plan.name}`} onClick={() => edit(plan)}>Chỉnh sửa</Button>
}

export const planColumns = helper.columns([
  helper.accessor("name", { header: "Gói", cell: ({ getValue }) => <Badge variant="outline">{getValue()}</Badge>, meta: { label: "Gói" } }),
  helper.accessor("priceVnd", {
    header: "Giá",
    cell: ({ getValue, row }) => <span className="tabular-nums">{row.original.code === "FREE" ? "Miễn phí" : money(getValue())}</span>,
    meta: { label: "Giá" },
  }),
  helper.accessor("durationDays", {
    header: "Chu kỳ",
    cell: ({ getValue }) => getValue() === null ? "Mỗi ngày" : `${getValue()} ngày`,
    meta: { label: "Chu kỳ" },
  }),
  helper.accessor("textLimit", { header: "Lượt AI chữ", cell: ({ getValue }) => count.format(getValue()), meta: { label: "Lượt AI chữ" } }),
  helper.accessor("imageLimit", { header: "Lượt tạo ảnh", cell: ({ getValue }) => count.format(getValue()), meta: { label: "Lượt tạo ảnh" } }),
  helper.display({ id: "actions", header: "Thao tác", cell: ({ row }) => <EditPlan plan={row.original} />, meta: { label: "Thao tác" } }),
])
