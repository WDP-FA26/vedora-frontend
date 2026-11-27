const joinDate = new Intl.DateTimeFormat("vi", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function formatJoinDate(iso: string) {
  return joinDate.format(new Date(iso))
}
