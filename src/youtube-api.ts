import { Data, Effect } from "effect"

class YouTubeApiError extends Data.TaggedError("YouTubeApiError")<{ reason: "load" | "timeout" }> {}

/** YouTube IFrame Player API を読み込む。読み込み済みならすぐに終わる */
export const loadYouTubeApi: Effect.Effect<void, YouTubeApiError> = Effect.suspend(() => {
  if (window.YT?.Player) return Effect.void
  return Effect.callback<void, YouTubeApiError>((resume) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resume(Effect.void)
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.addEventListener("error", () => resume(Effect.fail(new YouTubeApiError({ reason: "load" }))))
    document.head.append(script)
  }).pipe(Effect.timeoutOrElse({ duration: "30 seconds", orElse: () => Effect.fail(new YouTubeApiError({ reason: "timeout" })) }))
})

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}
