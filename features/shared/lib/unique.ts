/** The distinct non-empty strings of `values`, in first-seen order. */
export function uniqueNonEmpty(values: readonly string[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    if (value !== "") seen.add(value)
  }
  return Array.from(seen)
}
