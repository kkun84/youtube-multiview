import { announce } from "@ui-sdk/core"
import type { UiDialogElement, UiFieldElement } from "@ui-sdk/web"
import { Effect, type Scope } from "effect"
import { icons } from "./icons"
import { byId, listen, q, whenDefined } from "./dom"
import { checkAddition, MAX, nameOf, PRESET, shifted } from "../core/lineup"
import { type App } from "./model"

export const openDialog = (): void => {
  byId<UiDialogElement>("dialog").open = true
}

function shift(app: App, id: string, step: number) {
  const next = shifted(app.state.ids, id, step)
  if (!next) return
  app.setOrder(next)
  app.persist()
  app.renderList()
  app.layout()
  app.paint()
  announce(`${nameOf(app.state, id)}を${next.indexOf(id) + 1}番目に移動しました`)
}

const items = (app: App) => [...app.list.querySelectorAll<HTMLElement>("mv-list-item")]

function remove(app: App, id: string) {
  const name = nameOf(app.state, id)
  const i = app.state.ids.indexOf(id)
  app.state.ids = app.state.ids.filter((x) => x !== id)
  app.render()
  announce(`${name}を削除しました`)
  const rest = items(app).toSorted((a, b) => Number(a.dataset["index"]) - Number(b.dataset["index"]))
  ;(rest[Math.min(i, rest.length - 1)]?.querySelector<HTMLElement>(".del") ?? byId("addInput")).focus()
}

function rebuild(app: App) {
  app.list.innerHTML = app.state.ids
    .map(
      (id) => `<mv-list-item value="${id}">
      <mv-list-handle><button type="button" class="ic grip">${icons.grip}</button></mv-list-handle>
      <span class="name"></span><span class="badge" hidden>音声オン</span>
      <button type="button" class="ic up">${icons.up}</button>
      <button type="button" class="ic down">${icons.down}</button>
      <ui-button><button type="button" class="del">削除</button></ui-button>
    </mv-list-item>`
    )
    .join("")
  for (const item of items(app)) {
    const id = item.getAttribute("value") ?? ""
    for (const [selector, by] of [
      [".up", -1],
      [".down", 1]
    ] as const) {
      q(item, selector).addEventListener("click", (e) => {
        if ((e.currentTarget as HTMLElement).getAttribute("aria-disabled") !== "true") shift(app, id, by)
      })
    }
    q(item, ".del").addEventListener("click", () => remove(app, id))
  }
}

/** 並べ替えの間は要素を作り直さない(フォーカスが外れるため)。並びはdata-indexとCSSのorderで変える */
export function renderList(app: App): void {
  const { state, list } = app
  const have = items(app).map((el) => el.getAttribute("value"))
  const same = have.length === state.ids.length && have.every((id) => id !== null && state.ids.includes(id))
  if (!same) rebuild(app)
  whenDefined("mv-list", () => {
    list.labelOf = (id: string) => nameOf(state, id)
    list.value = [...state.ids]
  })
  for (const item of items(app)) {
    const id = item.getAttribute("value") ?? ""
    const i = state.ids.indexOf(id)
    const name = nameOf(state, id)
    q(item, ".name").textContent = name
    q(item, ".badge").hidden = id !== state.audioId
    q(item, ".grip").setAttribute("aria-label", `${name}を移動`)
    const up = q(item, ".up")
    const down = q(item, ".down")
    up.setAttribute("aria-label", `${name}を上へ`)
    down.setAttribute("aria-label", `${name}を下へ`)
    up.setAttribute("aria-disabled", String(i === 0))
    down.setAttribute("aria-disabled", String(i === state.ids.length - 1))
    q(item, ".del").setAttribute("aria-label", `${name}を削除`)
  }
  byId("emptyList").hidden = state.ids.length > 0
  const input = byId<HTMLInputElement>("addInput")
  const full = state.ids.length >= MAX
  input.disabled = full
  input.placeholder = full ? `${MAX}つまで並べています` : "https://www.youtube.com/watch?v=…"
}

function add(app: App) {
  const field = byId<UiFieldElement>("addField")
  const input = byId<HTMLInputElement>("addInput")
  const result = checkAddition(input.value, app.state.ids)
  const message = "error" in result ? result.error : ""
  byId("addError").textContent = message
  field.invalid = message ? true : undefined
  if ("error" in result) {
    input.focus()
    return
  }
  app.state.ids = [...app.state.ids, result.id]
  input.value = ""
  app.render()
  announce("動画を追加しました")
}

export const wireList = (app: App): Effect.Effect<void, never, Scope.Scope> =>
  Effect.all([
    listen<CustomEvent<{ value: string[] }>>(app.list, "valuechange", (e) => {
      app.setOrder([...e.detail.value])
      app.persist()
      app.renderList()
      app.layout()
      app.paint()
    }),
    listen(byId("addForm"), "submit", (e) => {
      e.preventDefault()
      add(app)
    }),
    listen(byId("preset"), "click", () => {
      app.state.ids = [...PRESET]
      app.render()
      announce("篝火#16の4配信に戻しました")
    }),
    listen(byId("openList"), "click", () => app.openDialog())
  ]).pipe(Effect.asVoid)
