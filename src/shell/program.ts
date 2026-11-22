import { toast } from "@ui-sdk/web"
import { Effect, type Scope } from "effect"
import { YouTube } from "./youtube-api"
import { makeApp } from "./app"
import { restore, wireBar } from "./bar"
import { wireBoard } from "./board"
import { wireChat } from "./chat"
import { wireList } from "./list"
import { watchPlayback } from "./playback"
import { Settings } from "./settings"

export const program: Effect.Effect<never, never, Settings | YouTube | Scope.Scope> = Effect.gen(function* () {
  const settings = yield* Settings
  const youtube = yield* YouTube
  const runSync = Effect.runSyncWith(yield* Effect.context<never>())
  const app = makeApp({
    save: (key, value) => runSync(settings.set(key, value)),
    load: (key, fallback) => runSync(settings.get(key, fallback)),
    createPlayer: youtube.createPlayer
  })
  yield* restore(app)
  yield* Effect.all([wireBar(app), wireBoard(app), wireList(app), wireChat(app), watchPlayback(app)])
  yield* youtube.load.pipe(
    Effect.tapError((e) =>
      Effect.sync(() =>
        toast.error(e.reason === "timeout" ? "YouTubeの読み込みに時間がかかっています" : "YouTubeを読み込めませんでした", {
          description: "ネットワークを確かめて、ページを開き直してください"
        })
      )
    ),
    Effect.andThen(
      Effect.sync(() => {
        app.state.ytReady = true
        app.render()
        if (app.load("mv-chat", "0") === "1") app.setChat(true)
      })
    ),
    Effect.ignore
  )
  return yield* Effect.never
})
