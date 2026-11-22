import { announce } from "@ui-sdk/core"
import { toast } from "@ui-sdk/web"
import type { UiDialogElement, UiFieldElement, UiSegmentedControlElement, UiSelectElement, UiChangeEvent, UiSwitchElement, UiToggleElement } from "@ui-sdk/web"
import { icons } from "./icons"
import { arrange, colChoices, type LayoutMode } from "./layout"
import { liveTarget, nextDelay, visibleDelay, type Sample } from "./live-delay"
import type { SortableElement } from "./sortable"
import { storage } from "./storage"
import { escapeHtml, formatDuration } from "./text"
import { setupUpdates } from "./update"
import { loadYouTubeApi } from "./youtube-api"
import { Effect, Schedule } from "effect"
import { isVideoId, parseVideoId } from "./youtube-id"

// トーストの表示先
;(document.getElementById("toasts") as unknown as { toaster: typeof toast }).toaster = toast

/** 人が押したときだけ呼ぶ(コードから pressed を変えたときは呼ばない) */
function onPress(el: HTMLElement, fn: (pressed: boolean) => void) {
  el.addEventListener("pressedchange", (e) => {
    const { value, reason } = (e as UiChangeEvent<boolean, string>).detail
    if (reason === "press") fn(value)
  })
}

/** 一定の間隔でくり返す。1回の失敗でくり返しを止めない */
function every(interval: `${number} seconds`, fn: () => void) {
  Effect.runFork(
    Effect.try(fn).pipe(
      Effect.catch((e) => Effect.logWarning("定期処理に失敗しました", e)),
      Effect.repeat(Schedule.spaced(interval)),
    ),
  )
}

const PRESET = ["QNZjuyvcjw8", "3UtyipqHJbw", "6Lp2NYJDVsQ", "_oNm1mKvgac"]
const MAX = 9
const GAP = 4

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} がありません`)
  return el as T
}
const q = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => root.querySelector<T>(selector)!

type Tile = {
  id: string
  el: HTMLElement
  player: YT.Player | null
  reveal: () => void
  /** 自分で一時停止した(自動で再生し直さない) */
  userPaused: boolean
  playing: boolean
  isLive: boolean
  /** ライブから遅れている秒数 */
  delay: number
  behind: number
  lastSample: Sample | null
  ui: { play: HTMLButtonElement; sound: HTMLButtonElement; zoom: HTMLButtonElement; soundT: UiToggleElement; zoomT: UiToggleElement; handT: UiToggleElement; zoomIcon: HTMLElement; grip: HTMLButtonElement; hand: HTMLButtonElement; live: HTMLButtonElement; target: HTMLButtonElement; title: HTMLElement }
}

/* ---------- 状態 ---------- */
let ids: string[] = []
const tiles = new Map<string, Tile>()
const titles = new Map<string, string>()
let audioId: string | null = null
let layoutMode: LayoutMode = "auto"
let focusId: string | null = null
let moveSource: string | null = null
let chatId: string | null = null
let ytReady = false
let seq = 0

const board = $<SortableElement>("board")
const list = $<SortableElement>("list")
const nameOf = (id: string) => titles.get(id) ?? `動画${ids.indexOf(id) + 1}`
// 大きく表示する動画。選ばれていないか消えていれば、音声を出している動画か先頭の動画にする
const focusedId = () => (focusId && ids.includes(focusId) ? focusId : audioId && ids.includes(audioId) ? audioId : ids[0])
const ytControls = () => document.body.classList.contains("yt-controls")
const allPaused = () => tiles.size > 0 && [...tiles.values()].every((t) => t.userPaused)

const layoutKey = (mode: LayoutMode) => String(mode)
function parseLayout(value: string): LayoutMode {
  if (value === "focus") return "focus"
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : "auto"
}

function persist() {
  storage.set("mv-ids", ids.join(","))
  storage.set("mv-layout", layoutKey(layoutMode))
  storage.set("mv-focus", focusId ?? "")
  history.replaceState(null, "", `#v=${ids.join(",")}`)
}

function setOrder(next: string[]) {
  ids = next
  board.value = [...ids]
  void customElements.whenDefined("mv-board").then(() => {
    board.value = [...ids]
  })
}

/* ---------- 並べ方 ---------- */
function layout() {
  // 縦長の画面でチャットを開いているときは、動画に必要な高さだけを使い、残りをチャットに渡す
  const stage = board.parentElement!
  const stacked = !$("chat").hasAttribute("hidden") && window.matchMedia("(orientation:portrait)").matches
  const height = stacked ? Math.round(stage.clientHeight * 0.58) : board.clientHeight
  let rects = arrange(ids, layoutMode, focusedId(), board.clientWidth, height, GAP)
  if (stacked && rects.length) {
    const top = Math.min(...rects.map((r) => r.y))
    const bottom = Math.max(...rects.map((r) => r.y + r.h))
    rects = rects.map((r) => ({ ...r, y: r.y - top }))
    board.style.flex = `0 0 ${Math.ceil(bottom - top)}px`
  } else {
    board.style.flex = ""
  }
  rects.forEach((r, i) => {
    board.style.setProperty(`--x${i}`, `${r.x}px`)
    board.style.setProperty(`--y${i}`, `${r.y}px`)
    board.style.setProperty(`--w${i}`, `${r.w}px`)
    board.style.setProperty(`--h${i}`, `${r.h}px`)
  })
}

function renderLayoutChoices() {
  const n = ids.length
  const seg = $<UiSegmentedControlElement>("layout")
  const choices: [LayoutMode, string][] = [
    ["auto", "自動"],
    ...(n > 1 ? colChoices(n).map((c): [LayoutMode, string] => [c, c === n ? "横一列" : `${c}列`]) : []),
    ...(n > 2 ? [["focus", "大きく"] as [LayoutMode, string]] : []),
  ]
  if (!choices.some(([v]) => v === layoutMode)) layoutMode = "auto"
  seg.innerHTML =
    "<ui-segmented-control-indicator></ui-segmented-control-indicator>" +
    choices.map(([v, label]) => `<ui-segmented-control-item value="${layoutKey(v)}">${label}</ui-segmented-control-item>`).join("")
  seg.hidden = n < 2
  void customElements.whenDefined("ui-segmented-control").then(() => {
    seg.value = layoutKey(layoutMode)
  })
}
$("layout").addEventListener("valuechange", (e) => {
  layoutMode = parseLayout(String((e as CustomEvent<{ value: string | null }>).detail.value ?? "auto"))
  persist()
  layout()
  paint()
})

/* ---------- 表示の更新 ---------- */
function paint() {
  const all = allPaused()
  q($("playAll"), ".pi").innerHTML = all ? icons.playSmall : icons.pauseSmall
  $("playAllLabel").textContent = all ? "全部を再生" : "全部を一時停止"
  for (const [id, t] of tiles) {
    const name = nameOf(id)
    const on = id === audioId
    const big = layoutMode === "focus" && focusedId() === id
    const { ui } = t
    t.el.toggleAttribute("data-audio", on)
    // 押した状態はトグルが読み上げるので、名前は押す前後で変えない
    ui.soundT.pressed = on
    ui.sound.setAttribute("aria-label", `${name}の音声`)
    ui.zoomT.pressed = big
    ui.zoom.setAttribute("aria-label", `${name}を大きく表示`)
    ui.zoomIcon.innerHTML = big ? icons.shrink : icons.grow
    ui.grip.setAttribute("aria-label", `${name}を移動`)
    ui.hand.setAttribute("aria-label", `${name}をYouTubeで直接操作(広告のスキップなど)`)
    ui.title.textContent = name
    ui.play.innerHTML = t.userPaused ? icons.play : icons.pause
    ui.play.setAttribute("aria-label", t.userPaused ? `${name}を再生` : `${name}を一時停止`)
    t.el.toggleAttribute("data-paused", t.userPaused)
    t.el.toggleAttribute("data-behind", t.behind > 0)
    ui.live.textContent = t.behind > 0 ? `${formatDuration(t.behind)}遅れ・最新へ` : ""
    ui.live.setAttribute("aria-label", `${name}は${formatDuration(t.behind)}遅れています。最新の位置へ移動`)
    ui.target.textContent = "ここへ移動"
    ui.target.setAttribute("aria-label", `${moveSource ? nameOf(moveSource) : ""}を${name}の位置へ移動`)
    t.el.toggleAttribute("data-move-source", moveSource === id)
  }
}

/* ---------- 音声・再生・拡大 ---------- */
function setAudio(id: string) {
  audioId = audioId === id ? null : id
  for (const [tid, t] of tiles) {
    const p = t.player
    if (!p?.mute) continue
    if (tid === audioId) {
      p.unMute()
      p.setVolume(100)
    } else p.mute()
    if (!t.userPaused) p.playVideo()
  }
  paint()
  renderList()
  announce(audioId ? `${nameOf(audioId)}の音声を出しています` : "音声を消しました")
}

function setPaused(t: Tile, paused: boolean) {
  t.userPaused = paused
  t.playing = !paused
  const p = t.player
  if (!p?.playVideo) return
  if (paused) p.pauseVideo()
  else {
    if (t.id !== audioId) p.mute()
    p.playVideo()
  }
  paint()
}

// 並び順は変えず、選んだ動画だけを大きい枠に入れる
function toggleFocus(id: string) {
  if (layoutMode === "focus" && focusedId() === id) layoutMode = "auto"
  else {
    focusId = id
    layoutMode = "focus"
  }
  renderLayoutChoices()
  persist()
  layout()
  paint()
  announce(layoutMode === "focus" ? `${nameOf(id)}を大きく表示しました` : "元の並びに戻しました")
}

/* ---------- 動画の枠 ---------- */
function makeTile(id: string): Tile {
  const key = `yt${++seq}`
  const el = document.createElement("mv-tile")
  el.setAttribute("value", id)
  el.innerHTML = `<span class="sr tile-title"></span><div class="frame"><div id="${key}"></div></div><div class="shield" aria-hidden="true"></div>
    <button type="button" class="live"></button>
    <div class="ended"><p>配信が終わったか、再生できなくなりました。</p><button type="button" data-variant="solid" class="endremove">一覧から外す</button></div>
    <button type="button" class="target"></button>
    <div class="direct" role="status"><span>YouTubeを操作中</span><button type="button" class="directEnd">終わる</button></div>
    <div class="controls">
      <button type="button" class="play"></button>
      <ui-toggle class="soundT"><button type="button" class="sound">${icons.sound}</button></ui-toggle>
      <ui-toggle class="zoomT"><button type="button" class="zoom"><span class="zi"></span></button></ui-toggle>
      <mv-handle><button type="button" class="grip">${icons.grip}</button></mv-handle>
      <ui-toggle class="handT"><button type="button" class="hand">${icons.hand}</button></ui-toggle>
    </div>`
  let hideTimer = 0
  const reveal = () => {
    el.setAttribute("data-show", "")
    clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => el.removeAttribute("data-show"), 4000)
  }
  const t: Tile = {
    id,
    el,
    player: null,
    reveal,
    userPaused: false,
    playing: true,
    isLive: false,
    delay: 0,
    behind: 0,
    lastSample: null,
    ui: {
      play: q(el, ".play"),
      sound: q(el, ".sound"),
      zoom: q(el, ".zoom"),
      soundT: q(el, ".soundT"),
      zoomT: q(el, ".zoomT"),
      handT: q(el, ".handT"),
      zoomIcon: q(el, ".zi"),
      grip: q(el, ".grip"),
      hand: q(el, ".hand"),
      live: q(el, ".live"),
      target: q(el, ".target"),
      title: q(el, ".tile-title"),
    },
  }
  const { ui } = t
  onPress(ui.soundT, () => setAudio(id))
  ui.play.addEventListener("click", () => {
    setPaused(t, !t.userPaused)
    announce(`${nameOf(id)}を${t.userPaused ? "一時停止しました" : "再生しました"}`)
  })
  onPress(ui.zoomT, () => toggleFocus(id))
  ui.live.addEventListener("click", () => {
    toLive(t)
    toast("最新の位置に合わせました")
  })
  ui.target.addEventListener("click", () => finishMove(id))
  q(el, ".endremove").addEventListener("click", () => {
    const name = nameOf(id)
    ids = ids.filter((x) => x !== id)
    render()
    announce(`${name}を一覧から外しました`)
  })

  // 広告のスキップなどYouTube側のボタンを押せるよう、この動画だけ透明な面を外す
  const setDirect = (on: boolean) => {
    el.toggleAttribute("data-direct", on)
    ui.handT.pressed = on
    if (on) toast("YouTubeを直接操作できます", { description: "広告のスキップなどを押したら「終わる」を押してください" })
    else announce(`${nameOf(id)}の直接操作を終えました`)
  }
  onPress(ui.handT, setDirect)
  q(el, ".directEnd").addEventListener("click", () => {
    setDirect(false)
    ui.hand.focus({ preventScroll: true })
  })

  // 移動ボタンのタップは移動先を選ぶ操作にする。ドラッグした後のクリックと、キーボード操作(並べ替えはUI SDKが扱う)は除く
  let downAt: { x: number; y: number } | null = null
  ui.grip.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY }
  })
  ui.grip.addEventListener("click", (e) => {
    if (e.detail === 0) return
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return
    if (moveSource === id) cancelMove()
    else startMove(id)
  })

  // ダブルタップを自前で判定する(iOSのdblclickはタッチ操作だと届かないことがある)
  let lastTap = 0
  q(el, ".shield").addEventListener("pointerup", (e) => {
    if (e.timeStamp - lastTap < 320) {
      lastTap = 0
      toggleFocus(id)
    } else {
      lastTap = e.timeStamp
      reveal()
    }
  })
  q(el, ".controls").addEventListener("pointerdown", reveal)
  // 操作ボタンの表示はここだけで決める。CSSの:hoverはタッチの後も残ることがあり、ボタンが消えなくなる
  el.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") reveal()
  })
  // キーボードで操作している間は出したままにし、フォーカスが外れたら4秒後に消す
  el.addEventListener("focusin", (e) => {
    if ((e.target as Element).matches(":focus-visible")) {
      el.setAttribute("data-show", "")
      clearTimeout(hideTimer)
    }
  })
  el.addEventListener("focusout", () => {
    if (el.hasAttribute("data-show")) reveal()
  })
  board.appendChild(el)

  const showTitle = () => {
    const title = (t.player?.getVideoData?.() as { title?: string } | undefined)?.title
    if (title && titles.get(id) !== title) {
      titles.set(id, title)
      paint()
      renderList()
      if (!$("chat").hidden) renderChatChoices()
    }
  }
  t.player = new YT.Player(key, {
    videoId: id,
    // YouTube側の操作表示(左上のタイトルや下の操作バー)は、操作パネルを使う設定のときだけ出す
    playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, iv_load_policy: 3, controls: ytControls() ? 1 : 0, disablekb: ytControls() ? 0 : 1 },
    events: {
      onReady: (e) => {
        e.target.mute()
        e.target.playVideo()
        showTitle()
      },
      onError: () => {
        el.setAttribute("data-ended", "")
        q(el, ".ended p").textContent = "この動画は再生できません。非公開か、埋め込みが許可されていない可能性があります。"
      },
      onStateChange: (e) => {
        showTitle()
        // 再生中(1)と読み込み中(3)を再生扱いにする。YouTubeの操作パネルで止めたときも表示を合わせる
        const playing = e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING
        if (playing !== t.playing) {
          t.playing = playing
          if (ytControls()) t.userPaused = !playing
          paint()
        }
        el.toggleAttribute("data-ended", e.data === YT.PlayerState.ENDED && t.isLive)
      },
    },
  })
  return t
}

function render() {
  if (!ytReady) return
  for (const [id, t] of tiles) {
    if (ids.includes(id)) continue
    try {
      t.player?.destroy()
    } catch {
      // すでに壊れていても枠は外す
    }
    t.el.remove()
    tiles.delete(id)
    if (audioId === id) audioId = null
  }
  const firstVisit = storage.get("mv-seen", "0") !== "1"
  for (const id of ids) {
    if (tiles.has(id)) continue
    const t = makeTile(id)
    tiles.set(id, t)
    if (firstVisit) t.reveal()
  }
  storage.set("mv-seen", "1")
  setOrder(ids)
  board.querySelector(".empty")?.remove()
  if (!ids.length) {
    board.insertAdjacentHTML("beforeend", '<div class="empty"><p>見たい動画を追加してください。</p><ui-button><button data-variant="solid">動画を追加する</button></ui-button></div>')
    q(board, ".empty button").addEventListener("click", openDialog)
  }
  if (moveSource && !ids.includes(moveSource)) cancelMove("")
  renderLayoutChoices()
  persist()
  layout()
  paint()
  renderList()
  if (!$("chat").hidden) renderChatChoices()
}

board.addEventListener("valuechange", (e) => {
  ids = [...(e as CustomEvent<{ value: string[] }>).detail.value]
  board.value = [...ids]
  persist()
  paint()
  renderList()
})

/* ---------- 一覧(ダイアログ) ---------- */
const openDialog = () => {
  $<UiDialogElement>("dialog").open = true
}

function shift(id: string, step: number) {
  const i = ids.indexOf(id)
  const j = i + step
  if (i < 0 || j < 0 || j >= ids.length) return
  const next = [...ids]
  next.splice(i, 1)
  next.splice(j, 0, id)
  setOrder(next)
  persist()
  renderList()
  layout()
  paint()
  announce(`${nameOf(id)}を${j + 1}番目に移動しました`)
}

// 並べ替えの間は要素を作り直さない(フォーカスが外れるため)。並びはdata-indexとCSSのorderで変える
function renderList() {
  const items = () => [...list.querySelectorAll<HTMLElement>("mv-list-item")]
  const have = items().map((el) => el.getAttribute("value"))
  const same = have.length === ids.length && have.every((id) => id !== null && ids.includes(id))
  if (!same) {
    list.innerHTML = ids
      .map(
        (id) => `<mv-list-item value="${id}">
      <mv-list-handle><button type="button" class="ic grip">${icons.grip}</button></mv-list-handle>
      <span class="name"></span><span class="badge" hidden>音声オン</span>
      <button type="button" class="ic up">${icons.up}</button>
      <button type="button" class="ic down">${icons.down}</button>
      <ui-button><button type="button" class="del">削除</button></ui-button>
    </mv-list-item>`,
      )
      .join("")
    for (const item of items()) {
      const id = item.getAttribute("value")!
      const step = (selector: string, by: number) =>
        q(item, selector).addEventListener("click", (e) => {
          if ((e.currentTarget as HTMLElement).getAttribute("aria-disabled") !== "true") shift(id, by)
        })
      step(".up", -1)
      step(".down", 1)
      q(item, ".del").addEventListener("click", () => {
        const name = nameOf(id)
        const i = ids.indexOf(id)
        ids = ids.filter((x) => x !== id)
        render()
        announce(`${name}を削除しました`)
        const rest = items().sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
        ;(rest[Math.min(i, rest.length - 1)]?.querySelector<HTMLElement>(".del") ?? $("addInput")).focus()
      })
    }
  }
  void customElements.whenDefined("mv-list").then(() => {
    list.labelOf = nameOf
    list.value = [...ids]
  })
  for (const item of items()) {
    const id = item.getAttribute("value")!
    const i = ids.indexOf(id)
    const name = nameOf(id)
    q(item, ".name").textContent = name
    q(item, ".badge").hidden = id !== audioId
    q(item, ".grip").setAttribute("aria-label", `${name}を移動`)
    const up = q(item, ".up")
    const down = q(item, ".down")
    up.setAttribute("aria-label", `${name}を上へ`)
    down.setAttribute("aria-label", `${name}を下へ`)
    up.setAttribute("aria-disabled", String(i === 0))
    down.setAttribute("aria-disabled", String(i === ids.length - 1))
    q(item, ".del").setAttribute("aria-label", `${name}を削除`)
  }
  $("emptyList").hidden = ids.length > 0
  const input = $<HTMLInputElement>("addInput")
  input.disabled = ids.length >= MAX
  input.placeholder = ids.length >= MAX ? `${MAX}つまで並べています` : "https://www.youtube.com/watch?v=…"
}
list.addEventListener("valuechange", (e) => {
  setOrder([...(e as CustomEvent<{ value: string[] }>).detail.value])
  persist()
  renderList()
  layout()
  paint()
})

$("addForm").addEventListener("submit", (e) => {
  e.preventDefault()
  const field = $<UiFieldElement>("addField")
  const input = $<HTMLInputElement>("addInput")
  const raw = input.value
  const id = parseVideoId(raw)
  let msg = ""
  if (!raw.trim()) msg = "URLを入れてください。"
  else if (!id) msg = "YouTubeの動画として読み取れません。チャンネルのURLではなく、動画や配信そのもののURLを入れてください。"
  else if (ids.includes(id)) msg = "この動画はもう並んでいます。"
  else if (ids.length >= MAX) msg = `並べられるのは${MAX}つまでです。どれかを削除してから追加してください。`
  $("addError").textContent = msg
  field.invalid = msg ? true : undefined
  if (msg || !id) {
    input.focus()
    return
  }
  ids = [...ids, id]
  input.value = ""
  render()
  announce("動画を追加しました")
})
$("preset").addEventListener("click", () => {
  ids = [...PRESET]
  render()
  announce("篝火#16の4配信に戻しました")
})
$("openList").addEventListener("click", openDialog)

/* ---------- ライブ ---------- */
function measureLive() {
  let changed = false
  const at = performance.now() / 1000
  for (const t of tiles.values()) {
    const p = t.player
    if (!p?.getCurrentTime) continue
    t.isLive = Boolean((p.getVideoData?.() as { isLive?: boolean } | undefined)?.isLive)
    const sample = { position: p.getCurrentTime(), at }
    if (t.isLive) t.delay = nextDelay(t.delay, t.lastSample, sample, p.getPlaybackRate?.() || 1)
    t.lastSample = sample
    const shown = t.isLive ? visibleDelay(t.delay) : 0
    if (Math.abs(shown - t.behind) >= 1 || (shown === 0) !== (t.behind === 0)) {
      t.behind = shown
      changed = true
    }
  }
  const any = [...tiles.values()].some((t) => t.behind > 0)
  $("toLive").toggleAttribute("data-behind", any)
  if (changed) paint()
}
function toLive(t: Tile) {
  const p = t.player
  if (!p?.seekTo || !t.isLive) return
  const before = p.getCurrentTime()
  p.seekTo(liveTarget(p.getDuration(), before, t.delay), true)
  if (t.userPaused) setPaused(t, false)
  else p.playVideo()
  t.delay = 0
  t.behind = 0
  t.lastSample = null
  paint()
  // 配信によっては配信の長さと再生位置の基準が違うので、移動先とは比べず、押す前より後ろに戻されたときだけ合わせ直す
  Effect.runFork(
    Effect.sync(() => {
      if (p.getCurrentTime() < before - 5) {
        p.seekTo(p.getDuration() - 2, true)
        t.lastSample = null
      }
    }).pipe(Effect.delay("4 seconds")),
  )
}
$("toLive").addEventListener("click", () => {
  // 遅れの計測は外れることがあるので、押されたらライブ配信を全部最新の位置へ送る
  const live = [...tiles.values()].filter((t) => t.isLive)
  for (const t of live) toLive(t)
  toast(live.length ? `${live.length}件のライブ配信を最新の位置に合わせました` : "ライブ配信中の動画がありません")
})
every("2 seconds", measureLive)

/* ---------- タップで移動 ---------- */
function startMove(id: string) {
  moveSource = id
  document.body.setAttribute("data-moving", "")
  $("moveText").textContent = `「${nameOf(id)}」の移動先の動画をタップしてください`
  $("movebar").hidden = false
  paint()
  board.querySelector<HTMLElement>(`mv-tile:not([value="${id}"]) .target`)?.focus({ preventScroll: true })
}
function cancelMove(message = "移動をやめました") {
  if (!moveSource) return
  const src = moveSource
  moveSource = null
  document.body.removeAttribute("data-moving")
  $("movebar").hidden = true
  paint()
  tiles.get(src)?.ui.grip.focus({ preventScroll: true })
  if (message) announce(message)
}
function finishMove(targetId: string) {
  const src = moveSource
  if (!src || src === targetId) return
  const index = ids.indexOf(targetId)
  const next = ids.filter((x) => x !== src)
  next.splice(index, 0, src)
  setOrder(next)
  persist()
  renderList()
  cancelMove(`${nameOf(src)}を${index + 1}番目に移動しました`)
  layout()
}
$("moveCancel").addEventListener("click", () => cancelMove())
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && moveSource) cancelMove()
})

/* ---------- ライブチャット ---------- */
function renderChatChoices() {
  const select = $<UiSelectElement>("chatSelect")
  if (!chatId || !ids.includes(chatId)) chatId = audioId && ids.includes(audioId) ? audioId : (ids[0] ?? null)
  q(select, "ui-select-content").innerHTML = ids.map((id) => `<ui-select-item value="${id}">${escapeHtml(nameOf(id))}</ui-select-item>`).join("")
  void customElements.whenDefined("ui-select").then(() => {
    if (chatId) select.value = chatId
  })
  loadChat()
}
function loadChat() {
  if ($("chat").hidden || !chatId) return
  const src = `https://www.youtube.com/live_chat?v=${chatId}&embed_domain=${location.hostname}&dark_theme=1`
  const frame = $<HTMLIFrameElement>("chatFrame")
  if (frame.getAttribute("src") !== src) frame.setAttribute("src", src)
  const open = $<HTMLAnchorElement>("chatOpen")
  open.href = `https://www.youtube.com/live_chat?v=${chatId}`
  open.setAttribute("aria-label", `${nameOf(chatId)}のチャットをYouTubeで開く`)
}
function setChat(open: boolean) {
  $("chat").hidden = !open
  $<UiToggleElement>("chatToggle").pressed = open
  if (open) renderChatChoices()
  else $("chatFrame").removeAttribute("src")
  requestAnimationFrame(layout)
  storage.set("mv-chat", open ? "1" : "0")
}
onPress($("chatToggle"), setChat)
$("chatClose").addEventListener("click", () => {
  setChat(false)
  $("chatBtn").focus()
})
$("chatSelect").addEventListener("valuechange", (e) => {
  const value = (e as CustomEvent<{ value: string | null }>).detail.value
  if (value) {
    chatId = value
    loadChat()
  }
})

/* ---------- 全体の操作 ---------- */
$("playAll").addEventListener("click", () => {
  const resume = allPaused()
  for (const t of tiles.values()) setPaused(t, !resume)
  announce(resume ? "全部の動画を再生しました" : "全部の動画を一時停止しました")
})
$("muteAll").addEventListener("click", () => {
  for (const t of tiles.values()) t.player?.mute?.()
  audioId = null
  paint()
  renderList()
  announce("音声を消しました")
})
$<UiSwitchElement>("ytSwitch").addEventListener("checkedchange", (e) => {
  const on = Boolean((e as CustomEvent<{ value: boolean }>).detail.value)
  document.body.classList.toggle("yt-controls", on)
  storage.set("mv-yt", on ? "1" : "0")
  // 操作表示の有無はプレーヤーを作るときにしか決められないので、作り直す
  const keep = [...ids]
  ids = []
  render()
  ids = keep
  render()
  announce(on ? "YouTubeの操作パネルを表示しました" : "YouTubeの操作パネルを隠しました")
})

const resizes = new ResizeObserver(() => layout())
resizes.observe(board)
resizes.observe(board.parentElement!)

// iPadのSafariは、音声付きの動画を再生すると他の動画を止めることがある。無音の動画が止まっていたら再生し直す
every("3 seconds", () => {
  if (ytControls()) return
  for (const [id, t] of tiles) {
    const p = t.player
    if (!p?.getPlayerState || id === audioId || t.userPaused) continue
    if (p.getPlayerState() === YT.PlayerState.PAUSED) {
      p.mute()
      p.playVideo()
    }
  }
})

/* ---------- 起動 ---------- */
export async function start() {
  customElements.whenDefined("mv-board").then(() => {
    board.labelOf = nameOf
  })
  const fromHash = location.hash.match(/v=([\w,-]*)/)?.[1]
  ids = (fromHash ?? storage.get("mv-ids", PRESET.join(",")))
    .split(",")
    .filter(isVideoId)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, MAX)
  // 以前の版は自動を "0" で保存していた
  layoutMode = parseLayout(storage.get("mv-layout", "auto"))
  focusId = storage.get("mv-focus", "") || null
  if (storage.get("mv-yt", "0") === "1") {
    document.body.classList.add("yt-controls")
    void customElements.whenDefined("ui-switch").then(() => {
      $<UiSwitchElement>("ytSwitch").checked = true
    })
  }
  setupUpdates($("updatebar"), $("updateNow"), $("checkUpdate"), $("versionText"))
  const loaded = await Effect.runPromise(
    loadYouTubeApi.pipe(
      Effect.as(true),
      Effect.catchTag("YouTubeApiError", (e) =>
        Effect.sync(() => {
          toast.error(e.reason === "timeout" ? "YouTubeの読み込みに時間がかかっています" : "YouTubeを読み込めませんでした", {
            description: "ネットワークを確かめて、ページを開き直してください",
          })
          return false
        }),
      ),
    ),
  )
  if (!loaded) return
  ytReady = true
  render()
  if (storage.get("mv-chat", "0") === "1") setChat(true)
}
