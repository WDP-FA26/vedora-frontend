const NUMBER_DECIMAL_VI = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const CURRENCY_VND = new Intl.NumberFormat("vi-VN")

/** Human-friendly distance label from meters (`350 m` / `1,2 km`). */
export function formatDistance(meters: number): string {
  const rounded = Math.max(0, Math.round(meters))
  if (rounded < 1000) return `${rounded} m`
  return `${NUMBER_DECIMAL_VI.format(rounded / 1000)} km`
}

export function formatPriceVnd(priceVnd: number | null): string | null {
  if (priceVnd === null) return null
  if (priceVnd === 0) return "Miễn phí"
  return `${CURRENCY_VND.format(priceVnd)} đ`
}

export function formatRatingScore(rating: number): string {
  return NUMBER_DECIMAL_VI.format(rating)
}
