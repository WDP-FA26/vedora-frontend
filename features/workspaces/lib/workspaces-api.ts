import { sendJson, send } from "@/features/shared/lib/api-client"
import {
  adminWorkspaceDetailSchema,
  adminWorkspacePageSchema,
  adminWorkspaceSchema,
  workspaceDetailSchema,
  workspaceListSchema,
  workspaceProofUploadSchema,
  type AdminWorkspace,
  type RestaurantDetailsFormValues,
  type WorkspaceFormValues,
} from "@/features/workspaces/schemas"
import {
  adminWorkspaceKey,
  WORKSPACE_PROOF_UPLOADS_KEY,
  WORKSPACES_URL,
  workspaceKey,
} from "@/features/workspaces/workspaces-cache"

/** The API's `MAX_PAGE_LIMIT`. */
const PAGE_LIMIT = 50

export type WorkspaceApplication = Omit<WorkspaceFormValues, "proofs"> & {
  proofIds: string[]
}

export function fetchMyWorkspaces([url, token]: readonly [string, string]) {
  return sendJson(workspaceListSchema, url, token)
}

export function fetchWorkspace([url, token]: readonly [string, string]) {
  return sendJson(workspaceDetailSchema, url, token)
}

export function requestWorkspaceProofUpload(token: string, file: File) {
  return sendJson(workspaceProofUploadSchema, WORKSPACE_PROOF_UPLOADS_KEY, token, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  })
}

function applicationBody({ location, ...rest }: WorkspaceApplication) {
  return JSON.stringify({ ...rest, longitude: location.longitude, latitude: location.latitude })
}

export function createWorkspace(token: string, application: WorkspaceApplication) {
  return sendJson(workspaceDetailSchema, WORKSPACES_URL, token, {
    method: "POST",
    body: applicationBody(application),
  })
}

export function resubmitWorkspace(
  token: string,
  id: string,
  application: WorkspaceApplication
) {
  return sendJson(workspaceDetailSchema, `${workspaceKey(id)}/resubmit`, token, {
    method: "POST",
    body: applicationBody(application),
  })
}

export function updateWorkspaceDetails(
  token: string,
  id: string,
  { location, ...rest }: RestaurantDetailsFormValues
) {
  return sendJson(workspaceDetailSchema, `${workspaceKey(id)}/details`, token, {
    method: "PATCH",
    body: JSON.stringify({ ...rest, longitude: location.longitude, latitude: location.latitude }),
  })
}

export function addWorkspaceMember(token: string, id: string, username: string) {
  return sendJson(workspaceDetailSchema, `${workspaceKey(id)}/members`, token, {
    method: "POST",
    body: JSON.stringify({ username }),
  })
}

export async function removeWorkspaceMember(token: string, id: string, userId: string) {
  await send(`${workspaceKey(id)}/members/${userId}`, token, { method: "DELETE" })
}

/**
 * Every application, newest first. The admin table sorts, filters and
 * paginates in the browser, so it needs the whole list.
 */
export async function fetchAllAdminWorkspaces([url, token]: readonly [string, string]) {
  const workspaces: AdminWorkspace[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      adminWorkspacePageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    workspaces.push(...items)
    if (!meta.hasNextPage) return workspaces
  }
}

export function fetchAdminWorkspace([url, token]: readonly [string, string]) {
  return sendJson(adminWorkspaceDetailSchema, url, token)
}

export function reviewWorkspace(
  token: string,
  id: string,
  input: { decision: "APPROVED" | "REJECTED"; note?: string }
) {
  return sendJson(adminWorkspaceSchema, `${adminWorkspaceKey(id)}/review`, token, {
    method: "POST",
    body: JSON.stringify(input),
  })
}
