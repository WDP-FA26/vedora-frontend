"use client";

import { createContext, use, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/features/admin/components/data-table/data-table";
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { RECIPE_CATEGORY_ICON_VIEWS } from "@/features/recipes/category-icons";
import {
  DeleteRowDialog,
  EditButton,
  FormDialog,
  RowActions,
  RowActionsContext,
  TableStatus,
} from "@/features/recipes/components/catalog-parts";
import {
  useRecipeCategories,
  useRefreshRecipeCatalog,
} from "@/features/recipes/hooks/use-recipe-catalog";
import {
  reorderRecipeCategories,
  saveRecipeCategory,
} from "@/features/recipes/lib/recipes-api";
import { RECIPE_CATEGORIES_KEY } from "@/features/recipes/recipes-cache";
import {
  RECIPE_CATEGORY_ICONS,
  recipeCategoryFormSchema,
  recipeCategoryIconSchema,
  type RecipeCategory,
  type RecipeCategoryFormValues,
} from "@/features/recipes/schemas";
import {
  RECIPE_TAGS,
  RECIPE_TAG_VIEWS,
  recipeTagSchema,
} from "@/features/recipes/tags";
import { ApiError } from "@/features/shared/lib/api-client";

const helper = createColumnHelper<DataTableFeatures, RecipeCategory>();

type MoveDirection = "up" | "down";

/** Lets the static columns move a row; `ids` is the current order, first to last. */
const MoveContext = createContext<{
  ids: readonly string[];
  moving: boolean;
  onMove: (id: string, direction: MoveDirection) => void;
}>({ ids: [], moving: false, onMove: () => {} });

function MoveButtons({ id, name }: { id: string; name: string }) {
  const { ids, moving, onMove } = use(MoveContext);
  const index = ids.indexOf(id);
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Đưa ${name} lên trên`}
        disabled={moving || index <= 0}
        onClick={() => onMove(id, "up")}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Đưa ${name} xuống dưới`}
        disabled={moving || index === -1 || index >= ids.length - 1}
        onClick={() => onMove(id, "down")}
      >
        <ArrowDownIcon aria-hidden />
      </Button>
    </div>
  );
}

/** The order with `id` swapped with its neighbour, or null when it is already at that end. */
function movedOrder(
  ids: readonly string[],
  id: string,
  direction: MoveDirection,
) {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  next[index] = ids[target];
  next[target] = id;
  return next;
}

const columns = helper.columns([
  helper.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Danh mục" />
    ),
    cell: ({ row }) => {
      const Icon = RECIPE_CATEGORY_ICON_VIEWS[row.original.icon].icon;
      return (
        <div className="max-w-80 min-w-40 whitespace-normal">
          <div className="flex flex-wrap items-center gap-1.5">
            <Icon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <EditButton id={row.original.id}>{row.original.name}</EditButton>
            {row.original.hidden && <Badge variant="secondary">Đang ẩn</Badge>}
          </div>
          {row.original.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {row.original.description}
            </p>
          )}
        </div>
      );
    },
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Danh mục" },
  }),
  helper.accessor((row) => RECIPE_TAG_VIEWS[row.baseTag].label, {
    id: "baseTag",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nhóm chuẩn" />
    ),
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue()}</span>
    ),
    sortFn: "text",
    meta: { label: "Nhóm chuẩn" },
  }),
  helper.display({
    id: "order",
    header: "Thứ tự",
    cell: ({ row }) => (
      <MoveButtons id={row.original.id} name={row.original.name} />
    ),
    meta: { label: "Thứ tự", className: "w-24" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => (
      <RowActions id={row.original.id} name={row.original.name} />
    ),
    meta: { className: "w-10" },
  }),
]);

const getId = (row: RecipeCategory) => row.id;

/** Dish categories the admin manages; each one maps onto a fixed meal-planner kind. */
export function CategoriesTable() {
  const { categories, error, isLoading } = useRecipeCategories();
  const [editing, setEditing] = useState<RecipeCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<RecipeCategory | null>(null);
  const { accessToken } = useAuth();
  const refresh = useRefreshRecipeCatalog();
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const find = (id: string) => categories.find((row) => row.id === id) ?? null;
  const ids = categories.map((row) => row.id);

  async function move(id: string, direction: MoveDirection) {
    const next = movedOrder(ids, id, direction);
    if (!accessToken || !next) return;
    setMoving(true);
    setMoveError(null);
    try {
      await reorderRecipeCategories(accessToken, next);
      await refresh();
    } catch {
      setMoveError("Không đổi được thứ tự. Tải lại trang rồi thử lại nhé.");
    } finally {
      setMoving(false);
    }
  }

  return (
    <TableStatus
      isLoading={isLoading}
      error={error}
      subject="danh sách danh mục"
    >
      {moveError && (
        <p role="alert" className="px-3 pt-2 text-sm text-destructive">
          {moveError}
        </p>
      )}
      <MoveContext value={{ ids, moving, onMove: move }}>
        <RowActionsContext
          value={{
            onEdit: (id) => setEditing(find(id)),
            onDelete: (id) => setDeleting(find(id)),
          }}
        >
          <DataTable
            columns={columns}
            data={categories}
            getRowId={getId}
            searchPlaceholder="Tìm danh mục"
            emptyMessage="Chưa có danh mục nào."
            actions={
              <Button size="sm" onClick={() => setEditing("new")}>
                <PlusIcon aria-hidden />
                Thêm danh mục
              </Button>
            }
          />
        </RowActionsContext>
      </MoveContext>
      {editing !== null && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteRowDialog
        collection={RECIPE_CATEGORIES_KEY}
        row={deleting}
        title={`Xoá danh mục ${deleting?.name ?? ""}?`}
        description="Danh mục bị xoá hẳn. Muốn tạm thời không cho người dùng thấy thì bật “Ẩn” thay vì xoá."
        onClose={() => setDeleting(null)}
      />
    </TableStatus>
  );
}

const FORM_ID = "recipe-category-form";

const TAG_ITEMS = RECIPE_TAGS.map((tag) => ({
  value: tag,
  label: RECIPE_TAG_VIEWS[tag].label,
  icon: RECIPE_TAG_VIEWS[tag].icon,
}));

const ICON_ITEMS = RECIPE_CATEGORY_ICONS.map((icon) => ({
  value: icon,
  label: RECIPE_CATEGORY_ICON_VIEWS[icon].label,
  icon: RECIPE_CATEGORY_ICON_VIEWS[icon].icon,
}));

function CategoryForm({
  category,
  onClose,
}: {
  category: RecipeCategory | null;
  onClose: () => void;
}) {
  const { accessToken } = useAuth();
  const refresh = useRefreshRecipeCatalog();
  const form = useForm<RecipeCategoryFormValues>({
    resolver: zodResolver(recipeCategoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      baseTag: category?.baseTag ?? "RICE",
      icon: category?.icon ?? "UTENSILS",
      hidden: category?.hidden ?? false,
    },
  });
  const { isSubmitting, errors } = form.formState;

  async function onSubmit(values: RecipeCategoryFormValues) {
    if (!accessToken) return;
    try {
      await saveRecipeCategory(accessToken, category?.id, {
        name: values.name,
        description: values.description || undefined,
        baseTag: values.baseTag,
        icon: values.icon,
        hidden: values.hidden,
      });
      await refresh();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "NAME_TAKEN") {
        form.setError("name", { message: "Đã có danh mục tên này." });
      } else {
        form.setError("root", { message: "Không lưu được. Thử lại nhé." });
      }
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title={category ? "Sửa danh mục" : "Thêm danh mục"}
      description="Danh mục giúp người dùng tìm món theo loại. Nhóm chuẩn quyết định món được xếp vào bữa nào trong thực đơn."
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
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên danh mục</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                placeholder="Chè, sương sáo"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                Mô tả (không bắt buộc)
              </FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={2}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="baseTag"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Nhóm chuẩn</FieldLabel>
              <Select
                items={TAG_ITEMS}
                value={field.value}
                onValueChange={(next) => {
                  const parsed = recipeTagSchema.safeParse(next);
                  if (parsed.success) field.onChange(parsed.data);
                }}
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_ITEMS.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <Icon aria-hidden />
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Món thuộc danh mục này được thực đơn xếp như nhóm đã chọn, ví dụ
                “Chè” chọn “Tráng miệng”.
              </FieldDescription>
            </Field>
          )}
        />
        <Controller
          name="icon"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Biểu tượng</FieldLabel>
              <Select
                items={ICON_ITEMS}
                value={field.value}
                onValueChange={(next) => {
                  const parsed = recipeCategoryIconSchema.safeParse(next);
                  if (parsed.success) field.onChange(parsed.data);
                }}
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_ITEMS.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <Icon aria-hidden />
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          name="hidden"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Ẩn khỏi người dùng</FieldLabel>
                <FieldDescription>
                  Giữ lại danh mục nhưng không hiển thị cho người dùng.
                </FieldDescription>
              </FieldContent>
              <Switch
                id={field.name}
                name={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />
      </form>
    </FormDialog>
  );
}
