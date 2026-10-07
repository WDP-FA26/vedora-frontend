"use client"

import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createColumnHelper } from "@tanstack/react-table"
import { GroupIcon, PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  DeleteRowDialog,
  EditButton,
  FormDialog,
  RowActions,
  RowActionsContext,
  TableStatus,
} from "@/features/recipes/components/catalog-parts"
import { GroupsTable } from "@/features/recipes/components/groups-table"
import { NamedSelect, type SelectOption } from "@/features/recipes/components/named-select"
import {
  useIncompatibilityRules,
  useIngredientGroups,
  useIngredients,
  useRefreshRecipeCatalog,
} from "@/features/recipes/hooks/use-recipe-catalog"
import { saveRule } from "@/features/recipes/lib/recipes-api"
import { INCOMPATIBILITY_RULES_KEY } from "@/features/recipes/recipes-cache"
import {
  parseRuleSideKey,
  ruleFormSchema,
  ruleSideKey,
  type IncompatibilityRule,
  type RuleFormValues,
  type RuleSide,
} from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

function Side({ ruleId, side }: { ruleId: string; side: RuleSide }) {
  return (
    <div className="flex min-w-32 items-center gap-1.5 whitespace-normal">
      {side.kind === "GROUP" && <Badge variant="outline">Nhóm</Badge>}
      <EditButton id={ruleId}>{side.name}</EditButton>
    </div>
  )
}

const helper = createColumnHelper<DataTableFeatures, IncompatibilityRule>()

const columns = helper.columns([
  helper.accessor((row) => row.a.name, {
    id: "a",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Không dùng" />,
    cell: ({ row }) => <Side ruleId={row.original.id} side={row.original.a} />,
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Không dùng" },
  }),
  helper.accessor((row) => row.b.name, {
    id: "b",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cùng với" />,
    cell: ({ row }) => <Side ruleId={row.original.id} side={row.original.b} />,
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Cùng với" },
  }),
  helper.accessor((row) => `${row.reason} ${row.source ?? ""}`, {
    id: "reason",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lý do" />,
    cell: ({ row }) => (
      <div className="max-w-md min-w-48 whitespace-normal">
        <p className="line-clamp-2">{row.original.reason}</p>
        {row.original.source && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            Nguồn: {row.original.source}
          </p>
        )}
      </div>
    ),
    enableSorting: false,
    meta: { label: "Lý do", className: "hidden md:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => (
      <RowActions
        id={row.original.id}
        name={`quy tắc ${row.original.a.name} và ${row.original.b.name}`}
      />
    ),
    meta: { className: "w-10" },
  }),
])

const getId = (row: IncompatibilityRule) => row.id

/** "A should not be eaten with B", where each side is an ingredient or a group. */
export function RulesTable() {
  const { rules, error, isLoading } = useIncompatibilityRules()
  const [editing, setEditing] = useState<IncompatibilityRule | "new" | null>(null)
  const [deleting, setDeleting] = useState<IncompatibilityRule | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const find = (id: string) => rules.find((row) => row.id === id) ?? null

  return (
    <TableStatus isLoading={isLoading} error={error} subject="danh sách quy tắc">
      <RowActionsContext
        value={{
          onEdit: (id) => setEditing(find(id)),
          onDelete: (id) => setDeleting(find(id)),
        }}
      >
        <DataTable
          columns={columns}
          data={rules}
          getRowId={getId}
          searchPlaceholder="Tìm theo tên hoặc lý do"
          emptyMessage="Chưa có quy tắc kỵ nhau nào."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setGroupsOpen(true)}>
                <GroupIcon aria-hidden />
                Nhóm nguyên liệu
              </Button>
              <Button size="sm" onClick={() => setEditing("new")}>
                <PlusIcon aria-hidden />
                Thêm quy tắc
              </Button>
            </>
          }
        />
      </RowActionsContext>
      <Sheet open={groupsOpen} onOpenChange={setGroupsOpen}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Nhóm nguyên liệu</SheetTitle>
            <SheetDescription>
              Một quy tắc đặt cho nhóm áp dụng cho mọi nguyên liệu trong nhóm.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t">
            <GroupsTable />
          </div>
        </SheetContent>
      </Sheet>
      {editing !== null && (
        <RuleForm
          key={editing === "new" ? "new" : editing.id}
          rule={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteRowDialog
        collection={INCOMPATIBILITY_RULES_KEY}
        row={deleting}
        title="Xoá quy tắc này?"
        description={
          deleting
            ? `Công thức có ${deleting.a.name} và ${deleting.b.name} sẽ không còn bị cảnh báo.`
            : ""
        }
        onClose={() => setDeleting(null)}
      />
    </TableStatus>
  )
}

const FORM_ID = "incompatibility-rule-form"

function RuleForm({
  rule,
  onClose,
}: {
  rule: IncompatibilityRule | null
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const { ingredients } = useIngredients()
  const { groups } = useIngredientGroups()
  const refresh = useRefreshRecipeCatalog()
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      a: rule ? ruleSideKey(rule.a) : "",
      b: rule ? ruleSideKey(rule.b) : "",
      reason: rule?.reason ?? "",
      source: rule?.source ?? "",
    },
  })
  const { isSubmitting, errors } = form.formState

  const options: SelectOption[] = [
    ...groups.map((group) => ({
      id: ruleSideKey({ kind: "GROUP", id: group.id }),
      name: `Nhóm: ${group.name}`,
    })),
    ...ingredients.map((ingredient) => ({
      id: ruleSideKey({ kind: "INGREDIENT", id: ingredient.id }),
      name: ingredient.name,
      keywords: ingredient.aliases.join(" "),
    })),
  ]

  async function onSubmit(values: RuleFormValues) {
    if (!accessToken) return
    try {
      await saveRule(accessToken, rule?.id, {
        a: parseRuleSideKey(values.a),
        b: parseRuleSideKey(values.b),
        reason: values.reason,
        source: values.source || undefined,
      })
      await refresh()
      onClose()
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiError && error.code === "RULE_EXISTS"
            ? "Cặp này đã có quy tắc."
            : "Không lưu được. Thử lại nhé.",
      })
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title={rule ? "Sửa quy tắc kỵ nhau" : "Thêm quy tắc kỵ nhau"}
      description="Công thức có cả hai vế sẽ hiện cảnh báo. Quy tắc không chặn việc lưu công thức."
      formId={FORM_ID}
      submitting={isSubmitting}
      rootError={errors.root?.message}
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {(
          [
            { name: "a", label: "Không dùng" },
            { name: "b", label: "Cùng với" },
          ] as const
        ).map(({ name, label }) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                <NamedSelect
                  id={field.name}
                  options={options}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Tìm nguyên liệu hoặc nhóm"
                  invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ))}
        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Lý do</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={2}
                aria-invalid={fieldState.invalid}
                placeholder="Điều gì xảy ra khi ăn chung?"
              />
              <FieldDescription>Hiện cùng cảnh báo trong công thức.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="source"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Nguồn (không bắt buộc)</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                placeholder="Tên tài liệu hoặc đường dẫn"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </form>
    </FormDialog>
  )
}
