const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Past this many days a post shows its date instead of "N ngày trước". */
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

/**
 * Social-style timestamp: "Vừa xong", "5 phút trước", "3 giờ trước",
 * "2 ngày trước", then the date ("17 thg 11", with the year when it is not
 * the current one). A time slightly in the future (clock skew between the
 * server and this device) counts as "Vừa xong". Depends on `now`, so render it
 * on the client only; see `RelativeTime`.
 */
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
