import { announce } from "@ui-sdk/core"
import { toast } from "@ui-sdk/web"
import { Effect, Exit, Scope } from "effect"
import { icons } from "./icons"
import { listen, onPress, q } from "./dom"
import { nameOf } from "../core/lineup"
import { ytControls, type App, type Tile, type TileUi } from "./model"

const HIDE_AFTER = 4000
const DOUBLE_TAP = 320

const markup = (
  key: string
) => `<span class="sr tile-title"></span><div class="frame"><div id="${key}"></div></div><div class="shield" aria-hidden="true"></div>
    <button type="button" class="live"></button>
    <div class="ended"><p>配信が終わったか、再生できなくなりました。</p><button type="button" data-variant="solid" class="endremove">一覧から外す</button></div>
    <button type="button" class="target"></button>
    <button type="button" class="more">${icons.more}</button>
    <div class="direct" role="status"><span>YouTubeを操作中</span><button type="button" class="directEnd">終わる</button></div>
    <ui-slider class="seek" min="0" max="1" step="1"><ui-slider-control><ui-slider-track><ui-slider-indicator></ui-slider-indicator><ui-slider-thumb></ui-slider-thumb></ui-slider-track></ui-slider-control></ui-slider>
    <div class="controls">
      <button type="button" class="play"></button>
      <button type="button" class="back extra">${icons.back}</button>
      <button type="button" class="forward extra">${icons.forward}</button>
      <ui-toggle class="soundT"><button type="button" class="sound">${icons.sound}</button></ui-toggle>
      <ui-toggle class="zoomT"><button type="button" class="zoom"><span class="zi"></span></button></ui-toggle>
      <mv-handle><button type="button" class="grip">${icons.grip}</button></mv-handle>
      <ui-toggle class="handT"><button type="button" class="hand">${icons.hand}</button></ui-toggle>
      <button type="button" class="full extra">${icons.full}</button>
    </div>`

const findUi = (el: HTMLElement): TileUi => ({
  play: q(el, ".play"),
  sound: q(el, ".sound"),
  zoom: q(el, ".zoom"),
  soundT: q(el, ".soundT"),
  zoomT: q(el, ".zoomT"),
  handT: q(el, ".handT"),
  zoomIcon: q(el, ".zi"),
  grip: q(el, ".grip"),
  back: q(el, ".back"),
  forward: q(el, ".forward"),
  full: q(el, ".full"),
  seek: q(el, ".seek"),
  seekThumb: q(el, "ui-slider-thumb"),
  hand: q(el, ".hand"),
  live: q(el, ".live"),
  target: q(el, ".target"),
  title: q(el, ".tile-title")
})

/** 操作ボタンの出し入れ。表示はここだけで決める。CSSの:hoverはタッチの後も残ることがあり、ボタンが消えなくなる */
const showControls = (app: App, el: HTMLElement) => {
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  const reveal = () => {
    el.dataset["show"] = ""
    clearTimeout(hideTimer)
    hideTimer = globalThis.setTimeout(() => delete el.dataset["show"], HIDE_AFTER)
  }
  const keep = () => {
    el.dataset["show"] = ""
    clearTimeout(hideTimer)
  }
  const wire = Effect.all([
    Effect.addFinalizer(() => Effect.sync(() => clearTimeout(hideTimer))),
    listen<PointerEvent>(el, "pointermove", (e) => {
      if (e.pointerType === "mouse") reveal()
    }),
    // タップやクリックの後もフォーカスは残るので、直前の操作がキーボードのときだけ出したままにする
    listen<FocusEvent>(el, "focusin", (e) => {
      if (app.state.lastInputWasKeyboard && (e.target as Element).matches(":focus-visible")) keep()
      else reveal()
    }),
    listen(el, "focusout", () => {
      if ("show" in el.dataset) reveal()
    })
  ])
  return { reveal, wire }
}

const playbackButtons = (app: App, t: Tile) => {
  const { ui } = t
  const skip = (seconds: number) => {
    const p = t.player
    if (!p?.seekTo) return
    p.seekTo(Math.max(0, p.getCurrentTime() + seconds), true)
    // 戻した分は遅れとして数え、進めた分は取り戻したものとして引く
    if (t.isLive) t.delay = Math.max(0, t.delay - seconds)
  }
  ui.full.hidden = !document.fullscreenEnabled
  return Effect.all([
    onPress(ui.soundT, () => app.setAudio(t.id)),
    onPress(ui.zoomT, () => app.toggleFocus(t.id)),
    listen(ui.play, "click", () => {
      app.setPaused(t, !t.userPaused)
      announce(`${nameOf(app.state, t.id)}を${t.userPaused ? "一時停止しました" : "再生しました"}`)
    }),
    listen(ui.live, "click", () => {
      app.toLive(t)
      toast("最新の位置に合わせました")
    }),
    listen(ui.back, "click", () => skip(-10)),
    listen(ui.forward, "click", () => skip(10)),
    listen(ui.seek, "valuecommit", () => {
      const { value } = ui.seek
      if (typeof value === "number") t.player?.seekTo(value, true)
    }),
    listen(ui.full, "click", () => {
      void (document.fullscreenElement === t.el ? document.exitFullscreen() : t.el.requestFullscreen()).catch(() => null)
    })
  ])
}

/** 広告のスキップなどYouTube側のボタンを押せるよう、この動画だけ透明な面を外す */
const directButtons = (app: App, t: Tile) => {
  const setDirect = (on: boolean) => {
    t.el.toggleAttribute("data-direct", on)
    t.ui.handT.pressed = on
    if (on) toast("YouTubeを直接操作できます", { description: "広告のスキップなどを押したら「終わる」を押してください" })
    else announce(`${nameOf(app.state, t.id)}の直接操作を終えました`)
  }
  return Effect.all([
    onPress(t.ui.handT, setDirect),
    listen(q(t.el, ".directEnd"), "click", () => {
      setDirect(false)
      t.ui.hand.focus({ preventScroll: true })
    })
  ])
}

const moveButtons = (app: App, t: Tile) => {
  // 移動ボタンのタップは移動先を選ぶ操作にする。ドラッグした後のクリックと、キーボード操作(並べ替えはUI SDKが扱う)は除く
  let downAt: { x: number; y: number } | null = null
  return Effect.all([
    listen<PointerEvent>(t.ui.grip, "pointerdown", (e) => {
      downAt = { x: e.clientX, y: e.clientY }
    }),
    listen<MouseEvent>(t.ui.grip, "click", (e) => {
      if (e.detail === 0) return
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return
      if (app.state.moveSource === t.id) app.cancelMove()
      else app.startMove(t.id)
    }),
    listen(t.ui.target, "click", () => app.finishMove(t.id)),
    listen(q(t.el, ".endremove"), "click", () => {
      const name = nameOf(app.state, t.id)
      app.state.ids = app.state.ids.filter((x) => x !== t.id)
      app.render()
      announce(`${name}を一覧から外しました`)
    })
  ])
}

const tapGestures = (app: App, t: Tile) => {
  // ダブルタップを自前で判定する(iOSのdblclickはタッチ操作だと届かないことがある)
  let lastTap = 0
  return Effect.all([
    listen<PointerEvent>(q(t.el, ".shield"), "pointerup", (e) => {
      if (e.timeStamp - lastTap < DOUBLE_TAP) {
        lastTap = 0
        app.toggleFocus(t.id)
      } else {
        lastTap = e.timeStamp
        t.reveal()
      }
    }),
    listen(q(t.el, ".controls"), "pointerdown", () => t.reveal()),
    listen(q(t.el, ".more"), "click", () => t.reveal())
  ])
}

const createPlayer = (app: App, t: Tile, key: string) => {
  const { state } = app
  const showTitle = () => {
    const title = (t.player?.getVideoData() as { title?: string } | undefined)?.title
    if (title && state.titles.get(t.id) !== title) {
      state.titles.set(t.id, title)
      app.paint()
      app.renderList()
      app.renderChatChoices()
    }
  }
  const yt = ytControls()
  return app.createPlayer(key, {
    videoId: t.id,
    // YouTube側の操作表示(左上のタイトルや下の操作バー)は、操作パネルを使う設定のときだけ出す
    playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, iv_load_policy: 3, controls: yt ? 1 : 0, disablekb: yt ? 0 : 1 },
    events: {
      onReady: (e) => {
        e.target.mute()
        e.target.playVideo()
        showTitle()
      },
      onError: () => {
        t.el.dataset["ended"] = ""
        q(t.el, ".ended p").textContent = "この動画は再生できません。非公開か、埋め込みが許可されていない可能性があります。"
      },
      onStateChange: (e) => {
        showTitle()
        // 再生中と読み込み中を再生扱いにする。YouTubeの操作パネルで止めたときも表示を合わせる
        const playing = e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING
        if (playing !== t.playing) {
          t.playing = playing
          if (ytControls()) t.userPaused = !playing
          app.paint()
        }
        t.el.toggleAttribute("data-ended", e.data === YT.PlayerState.ENDED && t.isLive)
      }
    }
  })
}

/** 動画の枠を作って並べる。枠を外すときは dispose を呼ぶ */
export function makeTile(app: App, id: string): Tile {
  app.state.seq += 1
  const key = `yt${app.state.seq}`
  const el = document.createElement("mv-tile")
  el.setAttribute("value", id)
  el.innerHTML = markup(key)
  const controls = showControls(app, el)
  const scope = Scope.makeUnsafe()
  const t: Tile = {
    id,
    el,
    player: null,
    reveal: controls.reveal,
    dispose: () => Effect.runSync(Scope.close(scope, Exit.void)),
    userPaused: false,
    playing: true,
    isLive: false,
    delay: 0,
    behind: 0,
    lastSample: null,
    ui: findUi(el)
  }
  Effect.runSync(
    Effect.all([controls.wire, playbackButtons(app, t), directButtons(app, t), moveButtons(app, t), tapGestures(app, t)]).pipe(
      Scope.provide(scope)
    )
  )
  app.board.append(el)
  t.player = createPlayer(app, t, key)
  return t
}
