import { sendJson, send } from "@/features/shared/lib/api-client"
import {
  adminWorkspaceDetailSchema,
  adminWorkspacePageSchema,
  adminWorkspaceSchema,
  taxCodeLookupSchema,
  menuImageUploadSchema,
  restaurantMenuItemSchema,
  restaurantMenuListSchema,
  restaurantMenuSearchPageSchema,
  restaurantReviewMutationResponseSchema,
  restaurantReviewPageSchema,
  restaurantReviewSummarySchema,
  workspaceDetailSchema,
  workspaceListSchema,
  workspaceProofUploadSchema,
  type AdminWorkspace,
  type RestaurantDetailsFormValues,
  type RestaurantReviewFormValues,
  type ReviewChecklist,
  type WorkspaceFormValues,
} from "@/features/workspaces/schemas"
import type { ProofKind, RejectReason } from "@/features/workspaces/onboarding"
import {
  adminWorkspaceKey,
  myRestaurantReviewKey,
  WORKSPACE_PROOF_UPLOADS_KEY,
  WORKSPACES_URL,
  workspaceKey,
  workspaceMenuImageUploadsKey,
  workspaceMenuKey,
} from "@/features/workspaces/workspaces-cache"

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

export function requestWorkspaceProofUpload(token: string, file: File, kind: ProofKind) {
  return sendJson(workspaceProofUploadSchema, WORKSPACE_PROOF_UPLOADS_KEY, token, {
    method: "POST",
    body: JSON.stringify({
      kind,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  })
}

function applicationBody({ location, otherPlatformUrls, legal, ...rest }: WorkspaceApplication) {
  return JSON.stringify({
    ...rest,
    longitude: location.longitude,
    latitude: location.latitude,
    otherPlatformUrls: otherPlatformUrls.map(({ url }) => url),
    legal: {
      ...legal,
      legalName: legal.entityType === "INDIVIDUAL" ? null : legal.legalName,
    },
  })
}

export function createWorkspace(token: string, application: WorkspaceApplication) {
  return sendJson(workspaceDetailSchema, WORKSPACES_URL, token, {
    method: "POST",
    body: applicationBody(application),
  })
}

export function resubmitWorkspace(token: string, id: string, application: WorkspaceApplication) {
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
    body: JSON.stringify({
      ...rest,
      longitude: location.longitude,
      latitude: location.latitude,
    }),
  })
}

export function addWorkspaceMember(token: string, id: string, username: string) {
  return sendJson(workspaceDetailSchema, `${workspaceKey(id)}/members`, token, {
    method: "POST",
    body: JSON.stringify({ username }),
  })
}

export async function removeWorkspaceMember(token: string, id: string, userId: string) {
  await send(`${workspaceKey(id)}/members/${userId}`, token, {
    method: "DELETE",
  })
}

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

export function fetchTaxCodeLookup([url, token]: readonly [string, string]) {
  return sendJson(taxCodeLookupSchema, url, token)
}

export type WorkspaceReviewInput =
  | { decision: "APPROVED"; checklist?: ReviewChecklist }
  | { decision: "REJECTED"; rejectReason: RejectReason; note?: string }

export function reviewWorkspace(token: string, id: string, input: WorkspaceReviewInput) {
  return sendJson(adminWorkspaceSchema, `${adminWorkspaceKey(id)}/review`, token, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type RestaurantMenuItemInput = {
  name: string
  description: string | null
  category: string | null
  priceVnd: number | null
  imageUrl: string | null
  isAvailable: boolean
  position?: number
}

export function fetchWorkspaceMenu([url, token]: readonly [string, string]) {
  return sendJson(restaurantMenuListSchema, url, token)
}

export function requestMenuImageUpload(token: string, workspaceId: string, file: File) {
  return sendJson(menuImageUploadSchema, workspaceMenuImageUploadsKey(workspaceId), token, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  })
}

export function createMenuItem(token: string, workspaceId: string, input: RestaurantMenuItemInput) {
  return sendJson(restaurantMenuItemSchema, workspaceMenuKey(workspaceId), token, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateMenuItem(
  token: string,
  workspaceId: string,
  itemId: string,
  input: Partial<RestaurantMenuItemInput>
) {
  return sendJson(restaurantMenuItemSchema, `${workspaceMenuKey(workspaceId)}/${itemId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export async function deleteMenuItem(token: string, workspaceId: string, itemId: string) {
  await send(`${workspaceMenuKey(workspaceId)}/${itemId}`, token, {
    method: "DELETE",
  })
}

export function fetchPublicRestaurantMenu(url: string) {
  return sendJson(restaurantMenuListSchema, url, undefined)
}

export function fetchMenuSearchPage(url: string) {
  return sendJson(restaurantMenuSearchPageSchema, url, undefined)
}

export function fetchRestaurantReviews([url, token]: readonly [string, string | undefined]) {
  return sendJson(restaurantReviewPageSchema, url, token)
}

export function upsertMyRestaurantReview(
  token: string,
  pageUserId: string,
  input: RestaurantReviewFormValues
) {
  return sendJson(
    restaurantReviewMutationResponseSchema,
    myRestaurantReviewKey(pageUserId),
    token,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  )
}

export function deleteMyRestaurantReview(token: string, pageUserId: string) {
  return sendJson(restaurantReviewSummarySchema, myRestaurantReviewKey(pageUserId), token, {
    method: "DELETE",
  })
}
