import type { UiSegmentedControlElement, UiSelectElement } from "@ui-sdk/web"
import { icons } from "./icons"
import { arrange, layoutChoices, packTop } from "../core/layout"
import { formatDuration } from "../core/text"
import { byId, q, whenDefined } from "./dom"
import { focusedId, GAP, layoutKey, nameOf } from "../core/lineup"
import { allPaused, type App, type Tile } from "./model"

let layoutQueued = 0

/** 配置を次の描画の直前に計算し直す。操作バーの作り直しの途中の高さを読まないようにする */
export function layout(app: App): void {
  cancelAnimationFrame(layoutQueued)
  layoutQueued = requestAnimationFrame(() => layoutNow(app))
}

function layoutNow({ board, state }: App) {
  // 縦長の画面でチャットを開いているときは、動画に必要な高さだけを使い、残りをチャットに渡す
  const stage = board.parentElement
  const stacked = !byId("chat").hidden && globalThis.matchMedia("(orientation:portrait)").matches
  const height = stacked && stage ? Math.round(stage.clientHeight * 0.58) : board.clientHeight
  let rects = arrange(state.ids, state.layoutMode, focusedId(state), board.clientWidth, height, GAP)
  if (stacked && rects.length > 0) {
    const packed = packTop(rects)
    rects = packed.rects
    board.style.flex = `0 0 ${Math.ceil(packed.height)}px`
  } else {
    board.style.flex = ""
  }
  for (const [i, r] of rects.entries()) {
    board.style.setProperty(`--x${i}`, `${r.x}px`)
    board.style.setProperty(`--y${i}`, `${r.y}px`)
    board.style.setProperty(`--w${i}`, `${r.w}px`)
    board.style.setProperty(`--h${i}`, `${r.h}px`)
  }
}

export function renderLayoutChoices({ state }: App): void {
  const n = state.ids.length
  const seg = byId<UiSegmentedControlElement>("layout")
  const choices = layoutChoices(n)
  if (!choices.some(([v]) => v === state.layoutMode)) state.layoutMode = "auto"
  seg.innerHTML = `<ui-segmented-control-indicator></ui-segmented-control-indicator>${choices
    .map(([v, label]) => `<ui-segmented-control-item value="${layoutKey(v)}">${label}</ui-segmented-control-item>`)
    .join("")}`
  seg.hidden = n < 2
  whenDefined("ui-segmented-control", () => {
    seg.value = layoutKey(state.layoutMode)
  })
  // スマホでは同じ選択肢を選択メニューで出す
  const select = byId<UiSelectElement>("layoutSelect")
  q(select, "ui-select-content").innerHTML = choices
    .map(([v, label]) => `<ui-select-item value="${layoutKey(v)}">${label}</ui-select-item>`)
    .join("")
  select.hidden = n < 2
  whenDefined("ui-select", () => {
    select.value = layoutKey(state.layoutMode)
  })
}

function paintTile({ state }: App, id: string, t: Tile) {
  const name = nameOf(state, id)
  const on = id === state.audioId
  const big = state.layoutMode === "focus" && focusedId(state) === id
  const { ui } = t
  t.el.toggleAttribute("data-audio", on)
  // 押した状態はトグルが読み上げるので、名前は押す前後で変えない
  ui.soundT.pressed = on
  ui.sound.setAttribute("aria-label", `${name}の音声`)
  ui.zoomT.pressed = big
  ui.zoom.setAttribute("aria-label", `${name}を大きく表示`)
  ui.zoomIcon.innerHTML = big ? icons.shrink : icons.grow
  ui.grip.setAttribute("aria-label", `${name}を移動`)
  ui.back.setAttribute("aria-label", `${name}を10秒戻す`)
  ui.forward.setAttribute("aria-label", `${name}を10秒進める`)
  ui.full.setAttribute("aria-label", `${name}を全画面で表示`)
  ui.seekThumb.setAttribute("aria-label", `${name}の再生位置`)
  ui.hand.setAttribute("aria-label", `${name}をYouTubeで直接操作(広告のスキップなど)`)
  ui.title.textContent = name
  ui.play.innerHTML = t.userPaused ? icons.play : icons.pause
  ui.play.setAttribute("aria-label", t.userPaused ? `${name}を再生` : `${name}を一時停止`)
  t.el.toggleAttribute("data-paused", t.userPaused)
  t.el.toggleAttribute("data-behind", t.behind > 0)
  ui.live.textContent = t.behind > 0 ? `${formatDuration(t.behind)}遅れ・最新へ` : ""
  ui.live.setAttribute("aria-label", `${name}は${formatDuration(t.behind)}遅れています。最新の位置へ移動`)
  ui.target.textContent = "ここへ移動"
  ui.target.setAttribute("aria-label", `${state.moveSource ? nameOf(state, state.moveSource) : ""}を${name}の位置へ移動`)
  t.el.toggleAttribute("data-move-source", state.moveSource === id)
}

export function paint(app: App): void {
  const all = allPaused(app.state)
  q(byId("playAll"), ".pi").innerHTML = all ? icons.playSmall : icons.pauseSmall
  byId("playAllLabel").textContent = all ? "全部を再生" : "全部を一時停止"
  for (const [id, t] of app.state.tiles) paintTile(app, id, t)
}
