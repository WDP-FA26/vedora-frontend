export const API_MUTATION_SETTLED = "vedora:api-mutation-settled"

export function notifyApiMutation(method: string | undefined) {
  if (
    typeof window !== "undefined" &&
    ["POST", "PUT", "PATCH", "DELETE"].includes((method ?? "GET").toUpperCase())
  )
    window.dispatchEvent(new Event(API_MUTATION_SETTLED))
}
