import type { PostDraft, DraftKind } from "./schemas"

export type DraftFile = {
  key: string
  mediaId: string
  name: string
  type: string
  size: number
  lastModified: number
  state: "queued" | "uploading" | "uploaded" | "ready" | "failed"
  media: PostDraft["media"][number] | null
  error?: string
}
export type LocalPostDraft = {
  key: string
  id: string
  ownerId: string
  kind: DraftKind
  body: string
  title: string
  description: string
  version: number | null
  synced: string
  revision: number
  updatedAt: number
  files: DraftFile[]
  removed: string[]
  error?: string
  conflict?: boolean
  deleted?: boolean
  publishing?: boolean
}
export const fingerprint = (draft: Pick<LocalPostDraft, "body" | "title" | "description">) =>
  JSON.stringify([draft.body, draft.title, draft.description])
export const localDraftKey = (ownerId: string, id: string) => `${ownerId}:${id}`
const fileKey = (draft: LocalPostDraft, key: string) => `${draft.key}:${key}`

let connection: Promise<IDBDatabase> | undefined
function db() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("vedora-post-drafts", 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts", { keyPath: "key" })
      request.result.createObjectStore("files")
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        connection = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => {
      connection = undefined
      reject(request.error)
    }
  })
  return connection
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
function committed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("Local save aborted"))
  })
}
export async function readLocalDrafts(ownerId: string) {
  const database = await db()
  const records = (await result(
    database.transaction("drafts", "readonly").objectStore("drafts").getAll()
  )) as LocalPostDraft[]
  return records.filter((item) => item.ownerId === ownerId)
}
export async function readDraftFile(draft: LocalPostDraft, key: string) {
  const database = await db()
  return result(
    database.transaction("files", "readonly").objectStore("files").get(fileKey(draft, key))
  ) as Promise<File | undefined>
}
export async function writeLocalDraft(
  draft: LocalPostDraft,
  files: { key: string; file: File }[] = [],
  removedKeys: string[] = []
) {
  const database = await db()
  const tx = database.transaction(["drafts", "files"], "readwrite")
  const done = committed(tx)
  tx.objectStore("drafts").put(draft)
  for (const item of files) tx.objectStore("files").put(item.file, fileKey(draft, item.key))
  for (const key of removedKeys) tx.objectStore("files").delete(fileKey(draft, key))
  await done
}
export async function forgetLocalDraft(draft: LocalPostDraft) {
  const database = await db()
  const tx = database.transaction(["drafts", "files"], "readwrite")
  const done = committed(tx)
  tx.objectStore("drafts").delete(draft.key)
  const cursor = tx
    .objectStore("files")
    .openKeyCursor(IDBKeyRange.bound(`${draft.key}:`, `${draft.key}:\uffff`))
  cursor.onsuccess = () => {
    const value = cursor.result
    if (value) {
      tx.objectStore("files").delete(value.key)
      value.continue()
    }
  }
  await done
}
