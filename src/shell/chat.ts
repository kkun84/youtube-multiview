import type { UiSelectElement, UiToggleElement } from "@ui-sdk/web"
import { Effect, type Scope } from "effect"
import { escapeHtml } from "../core/text"
import { byId, listen, onPress, q, whenDefined } from "./dom"
import { nameOf, watchUrl } from "../core/lineup"
import { type App } from "./model"

function loadChat({ state }: App) {
  if (byId("chat").hidden || !state.chatId) return
  const src = `https://www.youtube.com/live_chat?v=${state.chatId}&embed_domain=${location.hostname}&dark_theme=1`
  const frame = byId<HTMLIFrameElement>("chatFrame")
  if (frame.getAttribute("src") !== src) frame.setAttribute("src", src)
  const open = byId<HTMLAnchorElement>("chatOpen")
  open.href = `https://www.youtube.com/live_chat?v=${state.chatId}`
  open.setAttribute("aria-label", `${nameOf(state, state.chatId)}のチャットをYouTubeで開く`)
  const watch = byId<HTMLAnchorElement>("watchOpen")
  watch.href = watchUrl(state.chatId)
  watch.setAttribute("aria-label", `${nameOf(state, state.chatId)}の概要欄とコメントをYouTubeで開く`)
}

/** チャットを開いているときだけ、選べる配信と表示する配信を今の並びに合わせる */
export function renderChatChoices(app: App): void {
  const { state } = app
  if (byId("chat").hidden) return
  const select = byId<UiSelectElement>("chatSelect")
  if (!state.chatId || !state.ids.includes(state.chatId)) {
    state.chatId = state.audioId && state.ids.includes(state.audioId) ? state.audioId : (state.ids[0] ?? null)
  }
  q(select, "ui-select-content").innerHTML = state.ids
    .map((id) => `<ui-select-item value="${id}">${escapeHtml(nameOf(state, id))}</ui-select-item>`)
    .join("")
  whenDefined("ui-select", () => {
    if (state.chatId) select.value = state.chatId
  })
  loadChat(app)
}

export function setChat(app: App, open: boolean): void {
  byId("chat").hidden = !open
  byId<UiToggleElement>("chatToggle").pressed = open
  if (open) app.renderChatChoices()
  else byId("chatFrame").removeAttribute("src")
  app.layout()
  app.save("mv-chat", open ? "1" : "0")
}

export const wireChat = (app: App): Effect.Effect<void, never, Scope.Scope> =>
  Effect.all([
    onPress(byId("chatToggle"), (open) => app.setChat(open)),
    listen(byId("chatClose"), "click", () => {
      app.setChat(false)
      byId("chatBtn").focus()
    }),
    listen<CustomEvent<{ value: string | null }>>(byId("chatSelect"), "valuechange", (e) => {
      if (!e.detail.value) return
      app.state.chatId = e.detail.value
      loadChat(app)
    })
  ]).pipe(Effect.asVoid)
