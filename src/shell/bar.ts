import { announce } from "@ui-sdk/core"
import { toast, type UiSwitchElement } from "@ui-sdk/web"
import { Effect, type Scope } from "effect"
import { watchUpdates } from "./update"
import { byId, listen, whenDefined } from "./dom"
import { nameOf, parseIds, parseLayout, PRESET } from "../core/lineup"
import { allPaused, type App } from "./model"
import { wireMove } from "./move"
import { allToLive } from "./playback"

/** 保存した設定とURLから、前回の状態を戻す */
export const restore = (app: App) =>
  Effect.sync(() => {
    const { state } = app
    const fromHash = /v=([\w,-]*)/.exec(location.hash)?.[1]
    state.ids = parseIds(fromHash ?? app.load("mv-ids", PRESET.join(",")))
    state.layoutMode = parseLayout(app.load("mv-layout", "auto"))
    state.focusId = app.load("mv-focus", "") || null
    whenDefined("mv-board", () => {
      app.board.labelOf = (id: string) => nameOf(state, id)
    })
    if (app.load("mv-yt", "0") === "1") {
      document.body.classList.add("yt-controls")
      whenDefined("ui-switch", () => {
        byId<UiSwitchElement>("ytSwitch").checked = true
      })
    }
  })

export const wireBar = (app: App): Effect.Effect<void, never, Scope.Scope> =>
  Effect.all([
    // トーストの表示先
    Effect.sync(() => {
      ;(byId("toasts") as unknown as { toaster: typeof toast }).toaster = toast
    }),
    watchUpdates,
    wireMove(app),
    listen(byId("playAll"), "click", () => {
      const resume = allPaused(app.state)
      for (const t of app.state.tiles.values()) app.setPaused(t, !resume)
      announce(resume ? "全部の動画を再生しました" : "全部の動画を一時停止しました")
    }),
    listen(byId("muteAll"), "click", () => {
      for (const t of app.state.tiles.values()) t.player?.mute()
      app.state.audioId = null
      app.paint()
      app.renderList()
      announce("音声を消しました")
    }),
    listen(byId("toLive"), "click", () => allToLive(app)),
    ...["layout", "layoutSelect"].map((id) =>
      listen<CustomEvent<{ value: string | null }>>(byId(id), "valuechange", (e) => {
        const mode = parseLayout(e.detail.value ?? "auto")
        if (mode === app.state.layoutMode) return
        app.state.layoutMode = mode
        app.renderLayoutChoices()
        app.persist()
        app.layout()
        app.paint()
      })
    ),
    listen<CustomEvent<{ value: boolean }>>(byId("ytSwitch"), "checkedchange", (e) => {
      const on = Boolean(e.detail.value)
      document.body.classList.toggle("yt-controls", on)
      app.save("mv-yt", on ? "1" : "0")
      // 操作表示の有無はプレーヤーを作るときにしか決められないので、作り直す
      const keep = [...app.state.ids]
      app.state.ids = []
      app.render()
      app.state.ids = keep
      app.render()
      announce(on ? "YouTubeの操作パネルを表示しました" : "YouTubeの操作パネルを隠しました")
    }),
    // キーボードで操作しているかどうか。動画の操作ボタンを出したままにするかを決める
    listen(document, "keydown", () => (app.state.lastInputWasKeyboard = true), { capture: true }),
    listen(document, "pointerdown", () => (app.state.lastInputWasKeyboard = false), { capture: true })
  ]).pipe(Effect.asVoid)
