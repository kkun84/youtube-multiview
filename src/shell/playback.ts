import { announce } from "@ui-sdk/core"
import { toast } from "@ui-sdk/web"
import { Effect, Schedule, type Scope } from "effect"
import { liveTarget, nextDelay, visibleDelay } from "../core/live-delay"
import { byId } from "./dom"
import { focusedId, nameOf } from "../core/lineup"
import { ytControls, type App, type Tile } from "./model"

export function setAudio(app: App, id: string): void {
  const { state } = app
  state.audioId = state.audioId === id ? null : id
  for (const [tid, t] of state.tiles) {
    const p = t.player
    if (!p?.mute) continue
    if (tid === state.audioId) {
      p.unMute()
      p.setVolume(100)
    } else p.mute()
    if (!t.userPaused) p.playVideo()
  }
  app.paint()
  app.renderList()
  announce(state.audioId ? `${nameOf(state, state.audioId)}の音声を出しています` : "音声を消しました")
}

export function setPaused(app: App, t: Tile, paused: boolean): void {
  t.userPaused = paused
  t.playing = !paused
  const p = t.player
  if (!p?.playVideo) return
  if (paused) p.pauseVideo()
  else {
    if (t.id !== app.state.audioId) p.mute()
    p.playVideo()
  }
  app.paint()
}

/** 並び順は変えず、選んだ動画だけを大きい枠に入れる */
export function toggleFocus(app: App, id: string): void {
  const { state } = app
  if (state.layoutMode === "focus" && focusedId(state) === id) state.layoutMode = "auto"
  else {
    state.focusId = id
    state.layoutMode = "focus"
  }
  app.renderLayoutChoices()
  app.persist()
  app.layout()
  app.paint()
  announce(state.layoutMode === "focus" ? `${nameOf(state, id)}を大きく表示しました` : "元の並びに戻しました")
}

export function toLive(app: App, t: Tile): void {
  const p = t.player
  if (!p?.seekTo || !t.isLive) return
  const before = p.getCurrentTime()
  p.seekTo(liveTarget(p.getDuration(), before, t.delay), true)
  if (t.userPaused) app.setPaused(t, false)
  else p.playVideo()
  t.delay = 0
  t.behind = 0
  t.lastSample = null
  app.paint()
  // 配信によっては配信の長さと再生位置の基準が違うので、移動先とは比べず、押す前より後ろに戻されたときだけ合わせ直す
  Effect.runFork(
    Effect.sync(() => {
      if (p.getCurrentTime() < before - 5) {
        p.seekTo(p.getDuration() - 2, true)
        t.lastSample = null
      }
    }).pipe(Effect.delay("4 seconds"))
  )
}

/** 遅れの計測は外れることがあるので、押されたらライブ配信を全部最新の位置へ送る */
export function allToLive(app: App): void {
  const live = [...app.state.tiles.values()].filter((t) => t.isLive)
  for (const t of live) app.toLive(t)
  toast(live.length > 0 ? `${live.length}件のライブ配信を最新の位置に合わせました` : "ライブ配信中の動画がありません")
}

/** 一定の間隔で呼ぶ。止まっていた時間からライブの遅れを数える */
function measureLive(app: App): void {
  let changed = false
  const at = performance.now() / 1000
  for (const t of app.state.tiles.values()) {
    const p = t.player
    if (!p?.getCurrentTime) continue
    t.isLive = Boolean((p.getVideoData() as { isLive?: boolean } | undefined)?.isLive)
    const sample = { at, playing: p.getPlayerState() === YT.PlayerState.PLAYING }
    if (t.isLive) t.delay = nextDelay(t.delay, t.lastSample, sample)
    t.lastSample = sample
    const shown = t.isLive ? visibleDelay(t.delay) : 0
    if (Math.abs(shown - t.behind) >= 1 || (shown === 0) !== (t.behind === 0)) {
      t.behind = shown
      changed = true
    }
  }
  byId("toLive").toggleAttribute(
    "data-behind",
    [...app.state.tiles.values()].some((t) => t.behind > 0)
  )
  if (changed) app.paint()
}

/** 録画の動画は再生位置のバーを出す。ライブ配信は配信の長さが信用できないので出さない */
function syncSeekBars(app: App): void {
  for (const t of app.state.tiles.values()) {
    const p = t.player
    const duration = p?.getDuration?.() ?? 0
    const seekable = !t.isLive && duration > 0
    t.el.toggleAttribute("data-seekable", seekable)
    if (!p || !seekable || t.el.querySelector("ui-slider [data-dragging]")) continue
    t.ui.seek.max = Math.floor(duration)
    t.ui.seek.value = Math.floor(p.getCurrentTime())
  }
}

/** iPadのSafariは、音声付きの動画を再生すると他の動画を止めることがある。無音の動画が止まっていたら再生し直す */
function keepPlaying(app: App): void {
  if (ytControls()) return
  for (const [id, t] of app.state.tiles) {
    const p = t.player
    if (!p?.getPlayerState || id === app.state.audioId || t.userPaused) continue
    if (p.getPlayerState() === YT.PlayerState.PAUSED) {
      p.mute()
      p.playVideo()
    }
  }
}

const every = (interval: `${number} seconds`, run: () => void): Effect.Effect<void, never, Scope.Scope> =>
  Effect.forkScoped(
    Effect.try(run).pipe(
      Effect.catch((error) => Effect.logWarning("定期処理に失敗しました", error)),
      Effect.repeat(Schedule.spaced(interval))
    )
  ).pipe(Effect.asVoid)

/** 再生位置のバー、ライブの遅れ、止められた動画の再生し直しを、それぞれの間隔で確かめ続ける */
export const watchPlayback = (app: App): Effect.Effect<void, never, Scope.Scope> =>
  Effect.all([
    every("1 seconds", () => syncSeekBars(app)),
    every("2 seconds", () => measureLive(app)),
    every("3 seconds", () => keepPlaying(app))
  ]).pipe(Effect.asVoid)
