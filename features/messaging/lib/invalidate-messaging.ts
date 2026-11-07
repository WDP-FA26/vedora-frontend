import type { ScopedMutator } from "swr"
import { unstable_serialize } from "swr/infinite"
import {
  INBOX_REVISION_KEY,
  MESSAGING_KEY,
  messagePageKey,
} from "../messaging-cache"

/** A changed activity/relationship can invalidate inbox cursors: start from page one. */
export async function invalidateMessaging(
  mutate: ScopedMutator,
  token: string,
  conversationId?: string,
  messagesChanged = true,
) {
  const tasks: Promise<unknown>[] = [
    mutate(
      [INBOX_REVISION_KEY, token],
      (revision?: number) => (revision ?? 0) + 1,
      { revalidate: false },
    ),
    mutate(
      (key) =>
        Array.isArray(key) &&
        key[1] === token &&
        typeof key[0] === "string" &&
        key[0].startsWith(MESSAGING_KEY) &&
        (key[0].includes("/conversations/") || key[0].includes("/users/")) &&
        !key[0].includes("/messages"),
    ),
  ]
  if (conversationId && messagesChanged)
    tasks.push(
      mutate(
        unstable_serialize(
          () => [messagePageKey(conversationId), token] as const,
        ),
      ),
    )
  await Promise.all(tasks)
}
