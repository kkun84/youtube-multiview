import { Context, Data, Effect, Layer } from "effect"

class YouTubeApiError extends Data.TaggedError("YouTubeApiError")<{ reason: "load" | "timeout" }> {}

/** YouTube IFrame Player API */
export class YouTube extends Context.Service<
  YouTube,
  {
    /** APIを読み込む。読み込み済みならすぐに終わる */
    readonly load: Effect.Effect<void, YouTubeApiError>
    readonly createPlayer: (elementId: string, options: YT.PlayerOptions) => YT.Player
  }
>()("YouTube") {
  static readonly browser: Layer.Layer<YouTube> = Layer.succeed(this, {
    load: Effect.suspend(() => {
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
    }),
    createPlayer: (elementId, options) => new YT.Player(elementId, options)
  })
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}
