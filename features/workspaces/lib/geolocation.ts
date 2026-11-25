export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: 60_000,
}

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

/** Checks whether the current browser environment exposes the Geolocation API. */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator
}

/** Maps a browser or Mapbox geolocation error code to a user-facing Vietnamese message. */
export function geolocationErrorMessage(error: { code: number }): string {
  if (error.code === PERMISSION_DENIED) {
    return "Bạn chưa cấp quyền vị trí cho trình duyệt. Hãy bật quyền vị trí trong cài đặt trình duyệt và hệ điều hành rồi thử lại."
  }
  if (error.code === POSITION_UNAVAILABLE) {
    return "Không xác định được vị trí thiết bị lúc này. Kiểm tra dịch vụ vị trí của hệ điều hành (và bật Wi-Fi trên macOS) rồi thử lại."
  }
  if (error.code === TIMEOUT) {
    return "Hết thời gian chờ lấy vị trí. Hãy thử lại nhé."
  }
  return "Không lấy được vị trí hiện tại. Hãy thử lại nhé."
}
