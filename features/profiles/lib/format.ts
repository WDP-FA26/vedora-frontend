import { APP_TIME_ZONE } from "@/features/shared/lib/date-time"

const joinDate = new Intl.DateTimeFormat("vi", {
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
})

export function formatJoinDate(iso: string) {
  return joinDate.format(new Date(iso))
}
