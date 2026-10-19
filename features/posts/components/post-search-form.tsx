import Form from "next/form"
import { SearchIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { MAX_SEARCH_QUERY_LENGTH } from "@/features/posts/schemas"

/** Submits to the search page as `?q=`, with client-side navigation. */
export function PostSearchForm({
  defaultValue,
  autoFocus,
}: {
  defaultValue?: string
  autoFocus?: boolean
}) {
  return (
    <Form action="/home/search" role="search">
      <InputGroup variant="search">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          // A new query from the rail replaces the text on the search page.
          key={defaultValue}
          type="search"
          name="q"
          required
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          aria-label="Tìm kiếm trên Vedora"
          placeholder="Tìm món chay, mẹo nấu, nguyên liệu…"
        />
      </InputGroup>
    </Form>
  )
}
