const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const RELATIVE_DAYS_LIMIT = 7

const sameYearDate = new Intl.DateTimeFormat("vi", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

const otherYearDate = new Intl.DateTimeFormat("vi", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export function formatRelativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime()
  const elapsed = now - then

  if (elapsed < MINUTE) return "Vừa xong"
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} phút trước`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} giờ trước`
  if (elapsed < RELATIVE_DAYS_LIMIT * DAY) return `${Math.floor(elapsed / DAY)} ngày trước`

  const sameYear = new Date(then).getUTCFullYear() === new Date(now).getUTCFullYear()
  return sameYear ? sameYearDate.format(then) : otherYearDate.format(then)
}
