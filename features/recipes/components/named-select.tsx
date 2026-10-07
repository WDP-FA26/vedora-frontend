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
}

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
              {option.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
