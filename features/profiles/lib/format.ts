const joinDate = new Intl.DateTimeFormat("vi", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/** "tháng 10 năm 2026". Absolute, so server and client agree. */
export function formatJoinDate(iso: string) {
  return joinDate.format(new Date(iso))
}
