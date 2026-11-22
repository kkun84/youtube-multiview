import { announce } from "@ui-sdk/core"
import { Effect, type Scope } from "effect"
import { byId, listen } from "./dom"
import { movedTo, nameOf } from "../core/lineup"
import { type App } from "./model"

export function startMove(app: App, id: string): void {
  app.state.moveSource = id
  document.body.dataset["moving"] = ""
  byId("moveText").textContent = `「${nameOf(app.state, id)}」の移動先の動画をタップしてください`
  byId("movebar").hidden = false
  app.paint()
  app.board.querySelector<HTMLElement>(`mv-tile:not([value="${id}"]) .target`)?.focus({ preventScroll: true })
}

export function cancelMove(app: App, message = "移動をやめました"): void {
  const source = app.state.moveSource
  if (!source) return
  app.state.moveSource = null
  delete document.body.dataset["moving"]
  byId("movebar").hidden = true
  app.paint()
  app.state.tiles.get(source)?.ui.grip.focus({ preventScroll: true })
  if (message) announce(message)
}

export function finishMove(app: App, targetId: string): void {
  const source = app.state.moveSource
  if (!source || source === targetId) return
  const next = movedTo(app.state.ids, source, targetId)
  app.setOrder(next)
  app.persist()
  app.renderList()
  app.cancelMove(`${nameOf(app.state, source)}を${next.indexOf(source) + 1}番目に移動しました`)
  app.layout()
}

export const wireMove = (app: App): Effect.Effect<void, never, Scope.Scope> =>
  Effect.all([
    listen(byId("moveCancel"), "click", () => app.cancelMove()),
    listen<KeyboardEvent>(globalThis, "keydown", (e) => {
      if (e.key === "Escape" && app.state.moveSource) app.cancelMove()
    })
  ]).pipe(Effect.asVoid)
