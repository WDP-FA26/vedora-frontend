import Form from "next/form"
import { SearchIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import type { SearchTab } from "@/features/posts/posts-cache"
import { MAX_SEARCH_QUERY_LENGTH } from "@/features/posts/schemas"

export function PostSearchForm({
  defaultValue,
  autoFocus,
  tab,
}: {
  defaultValue?: string
  autoFocus?: boolean
  tab?: SearchTab
}) {
  return (
    <Form action="/home/search" role="search">
      {tab && tab !== "all" && <input type="hidden" name="tab" value={tab} />}
      <InputGroup variant="search">
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          key={defaultValue}
          type="search"
          name="q"
          required
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          aria-label="Tìm kiếm trên Vedora"
          placeholder="Tìm bài viết, mọi người, món chay…"
        />
      </InputGroup>
    </Form>
  )
}
