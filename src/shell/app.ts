import { render } from "./board"
import { renderChatChoices, setChat } from "./chat"
import { byId, whenDefined } from "./dom"
import { openDialog, renderList } from "./list"
import { layoutKey } from "../core/lineup"
import { initialState, type App } from "./model"
import { cancelMove, finishMove, startMove } from "./move"
import { setAudio, setPaused, toggleFocus, toLive } from "./playback"
import { layout, paint, renderLayoutChoices } from "./view"

type Deps = Pick<App, "save" | "load" | "createPlayer">

/** 画面の部品どうしが呼び合う操作をまとめる */
export const makeApp = (deps: Deps): App => {
  const state = initialState()
  const board = byId<App["board"]>("board")
  const app: App = {
    state,
    board,
    list: byId<App["list"]>("list"),
    ...deps,
    persist: () => {
      app.save("mv-ids", state.ids.join(","))
      app.save("mv-layout", layoutKey(state.layoutMode))
      app.save("mv-focus", state.focusId ?? "")
      history.replaceState(null, "", `#v=${state.ids.join(",")}`)
    },
    setOrder: (next) => {
      state.ids = [...next]
      board.value = [...state.ids]
      whenDefined("mv-board", () => {
        board.value = [...state.ids]
      })
    },
    layout: () => layout(app),
    renderLayoutChoices: () => renderLayoutChoices(app),
    paint: () => paint(app),
    render: () => render(app),
    renderList: () => renderList(app),
    renderChatChoices: () => renderChatChoices(app),
    setChat: (open) => setChat(app, open),
    setAudio: (id) => setAudio(app, id),
    setPaused: (tile, paused) => setPaused(app, tile, paused),
    toggleFocus: (id) => toggleFocus(app, id),
    toLive: (tile) => toLive(app, tile),
    startMove: (id) => startMove(app, id),
    cancelMove: (message) => cancelMove(app, message),
    finishMove: (id) => finishMove(app, id),
    openDialog
  }
  return app
}
