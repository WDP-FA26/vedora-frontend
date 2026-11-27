export function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    const url = URL.createObjectURL(file)
    const done = (value: number | null) => {
      clearTimeout(timer)
      video.onloadedmetadata = video.onerror = null
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => done(null), 5000)
    video.preload = "metadata"
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => done(null)
    video.src = url
  })
}
