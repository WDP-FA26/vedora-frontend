/** Product-facing dates use Vietnam time on both the server and the browser. */
export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh"

const calendarDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const clockHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
})

/** A calendar key, not a timestamp to be converted to UTC. */
export function vietnamDateKey(now: Date | number = new Date()): string {
  const parts = calendarDate.formatToParts(now)
  const year = parts.find(({ type }) => type === "year")!.value
  const month = parts.find(({ type }) => type === "month")!.value
  const day = parts.find(({ type }) => type === "day")!.value
  return `${year}-${month}-${day}`
}

export function vietnamYear(now: Date | number = new Date()): number {
  return Number(vietnamDateKey(now).slice(0, 4))
}

export function vietnamHour(now: Date | number = new Date()): number {
  return Number(clockHour.format(now))
}

/** Encode the selected Vietnam calendar day's inclusive bounds as UTC for APIs. */
export function vietnamDayBoundary(day: string, edge: "start" | "end"): string {
  const time = edge === "start" ? "00:00:00.000" : "23:59:59.999"
  return new Date(`${day}T${time}+07:00`).toISOString()
}
