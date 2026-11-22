/** YouTube IFrame Player API を読み込む。読み込み済みならすぐに解決する */
export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(script)
  })
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}
