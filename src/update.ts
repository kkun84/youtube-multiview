import { toast } from "@ui-sdk/web"
import { Effect, Option, Schedule } from "effect"
import { latestVersion } from "./version-check"

// ホーム画面のアプリは終了されにくく、古い版を表示し続ける。前面に戻ったときと数分おきに、公開中の版番号を確かめる

export function setupUpdates(bar: HTMLElement, updateButton: HTMLElement, checkButton: HTMLElement, versionText: HTMLElement): void {
  const check = (manual: boolean) =>
    latestVersion.pipe(
      Effect.tap((latest) =>
        Effect.sync(() => {
          const newer = Option.isSome(latest) && latest.value !== __APP_VERSION__
          if (newer) bar.hidden = false
          if (!manual) return
          if (newer) toast("新しい版があります")
          else toast(Option.isSome(latest) ? "最新版です" : "確認できませんでした。ネットワークを確かめてください")
        })
      )
    )
  // HTMLもキャッシュされているので、URLを変えて読み込み直す
  updateButton.addEventListener("click", () => location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`))
  checkButton.addEventListener("click", () => Effect.runFork(check(true)))
  versionText.textContent = `版: ${__APP_VERSION__}`
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") Effect.runFork(check(false))
  })
  Effect.runFork(check(false).pipe(Effect.repeat(Schedule.spaced("5 minutes"))))
}
