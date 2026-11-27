const compact = new Intl.NumberFormat("vi", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCount(value: number) {
  return compact.format(value)
}

const shortDate = new Intl.DateTimeFormat("vi", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

const fullDate = new Intl.DateTimeFormat("vi", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
})

export function formatPostDate(iso: string) {
  return shortDate.format(new Date(iso))
}

export function formatPostDateLong(iso: string) {
  return fullDate.format(new Date(iso))
}
