import { toast } from "@ui-sdk/web"
import { Effect, Option, Schedule, type Scope } from "effect"
import { byId, listen } from "./dom"
import { latestVersion } from "./version-check"

// ホーム画面のアプリは終了されにくく、古い版を表示し続ける。前面に戻ったときと数分おきに、公開中の版番号を確かめる

const check = (manual: boolean) =>
  latestVersion.pipe(
    Effect.tap((latest) =>
      Effect.sync(() => {
        const newer = Option.isSome(latest) && latest.value !== __APP_VERSION__
        if (newer) byId("updatebar").hidden = false
        if (!manual) return
        if (newer) toast("新しい版があります")
        else toast(Option.isSome(latest) ? "最新版です" : "確認できませんでした。ネットワークを確かめてください")
      })
    )
  )

export const watchUpdates: Effect.Effect<void, never, Scope.Scope> = Effect.gen(function* () {
  const runFork = Effect.runForkWith(yield* Effect.context<never>())
  byId("versionText").textContent = `版: ${__APP_VERSION__}`
  // HTMLもキャッシュされているので、URLを変えて読み込み直す
  yield* listen(byId("updateNow"), "click", () => location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`))
  yield* listen(byId("checkUpdate"), "click", () => runFork(check(true)))
  yield* listen(document, "visibilitychange", () => {
    if (document.visibilityState === "visible") runFork(check(false))
  })
  yield* Effect.forkScoped(check(false).pipe(Effect.repeat(Schedule.spaced("5 minutes"))))
})
