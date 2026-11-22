import { Effect, type Scope } from "effect"
import { listen, q } from "./dom"
import type { App, Tile } from "./model"
import { makeTile } from "./tile"

function removeTile(app: App, id: string, t: Tile) {
  t.dispose()
  try {
    t.player?.destroy()
  } catch {
    // すでに壊れていても枠は外す
  }
  t.el.remove()
  app.state.tiles.delete(id)
  if (app.state.audioId === id) app.state.audioId = null
}

function syncTiles(app: App) {
  const { state } = app
  for (const [id, t] of state.tiles) if (!state.ids.includes(id)) removeTile(app, id, t)
  const firstVisit = app.load("mv-seen", "0") !== "1"
  for (const id of state.ids) {
    if (state.tiles.has(id)) continue
    const t = makeTile(app, id)
    state.tiles.set(id, t)
    if (firstVisit) t.reveal()
  }
  app.save("mv-seen", "1")
}

function renderEmpty(app: App) {
  app.board.querySelector(".empty")?.remove()
  if (app.state.ids.length > 0) return
  app.board.insertAdjacentHTML(
    "beforeend",
    '<div class="empty"><p>見たい動画を追加してください。</p><ui-button><button data-variant="solid">動画を追加する</button></ui-button></div>'
  )
  q(app.board, ".empty button").addEventListener("click", () => app.openDialog())
}

/** 並べる動画が変わったときに、枠と画面全体を作り直す */
export function render(app: App): void {
  const { state } = app
  if (!state.ytReady) return
  syncTiles(app)
  app.setOrder(state.ids)
  renderEmpty(app)
  if (state.moveSource && !state.ids.includes(state.moveSource)) app.cancelMove("")
  app.renderLayoutChoices()
  app.persist()
  app.layout()
  app.paint()
  app.renderList()
  app.renderChatChoices()
}

/** ドラッグやキーボードで並べ替えたとき */
export const wireBoard = (app: App): Effect.Effect<void, never, Scope.Scope> =>
  Effect.all([
    listen<CustomEvent<{ value: string[] }>>(app.board, "valuechange", (e) => {
      app.state.ids = [...e.detail.value]
      app.board.value = [...app.state.ids]
      app.persist()
      app.paint()
      app.renderList()
    }),
    Effect.acquireRelease(
      Effect.sync(() => {
        const resizes = new ResizeObserver(() => app.layout())
        resizes.observe(app.board)
        if (app.board.parentElement) resizes.observe(app.board.parentElement)
        return resizes
      }),
      (resizes) => Effect.sync(() => resizes.disconnect())
    )
  ]).pipe(Effect.asVoid)
