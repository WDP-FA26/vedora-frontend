"use client"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

export type SelectOption = {
  id: string
  name: string
  /** Extra text the search matches, e.g. an ingredient's other names. */
  keywords?: string
  /** A second line under the name in the list. */
  detail?: string
}

/** Long catalogs render only the first matches; typing narrows them down. */
const MAX_VISIBLE_OPTIONS = 50

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()

/** Matches with or without Vietnamese tone marks: "dau hu" finds "Đậu hũ". */
function matches(option: SelectOption, query: string) {
  return fold(`${option.name} ${option.keywords ?? ""}`).includes(fold(query.trim()))
}

const sameOption = (a: SelectOption, b: SelectOption) => a.id === b.id
const optionLabel = (option: SelectOption) => option.name

/** Searchable single choice; `value` is the chosen id, or "" for none. */
export function NamedSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id?: string
  options: SelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <Combobox
      items={options}
      limit={MAX_VISIBLE_OPTIONS}
      value={options.find((option) => option.id === value) ?? null}
      onValueChange={(option) => onChange(option?.id ?? "")}
      itemToStringLabel={optionLabel}
      isItemEqualToValue={sameOption}
      filter={matches}
    >
      <ComboboxInput id={id} placeholder={placeholder} aria-invalid={invalid} />
      <ComboboxContent>
        <ComboboxEmpty>Không tìm thấy.</ComboboxEmpty>
        <ComboboxList>
          {(option: SelectOption) => (
            <ComboboxItem key={option.id} value={option}>
              {option.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/** Searchable multiple choice shown as chips; `value` is the chosen ids. */
export function NamedMultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id?: string
  options: SelectOption[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  invalid?: boolean
}) {
  const anchor = useComboboxAnchor()
  const selected = options.filter((option) => value.includes(option.id))

  return (
    <Combobox
      multiple
      items={options}
      limit={MAX_VISIBLE_OPTIONS}
      value={selected}
      onValueChange={(next) => onChange(next.map((option) => option.id))}
      itemToStringLabel={optionLabel}
      isItemEqualToValue={sameOption}
      filter={matches}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(chosen: SelectOption[]) => (
            <>
              {chosen.map((option) => (
                <ComboboxChip key={option.id}>{option.name}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={chosen.length === 0 ? placeholder : undefined}
                aria-invalid={invalid}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Không tìm thấy.</ComboboxEmpty>
        <ComboboxList>
          {(option: SelectOption) => (
            <ComboboxItem key={option.id} value={option}>
              {option.detail ? (
                <span className="min-w-0">
                  <span className="block">{option.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {option.detail}
                  </span>
                </span>
              ) : (
                option.name
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
