import type { UiSliderElement, UiToggleElement } from "@ui-sdk/web"
import type { LayoutMode } from "../core/layout"
import type { Sample } from "../core/live-delay"
import type { SortableElement } from "./sortable"

export type TileUi = {
  play: HTMLButtonElement
  sound: HTMLButtonElement
  zoom: HTMLButtonElement
  soundT: UiToggleElement
  zoomT: UiToggleElement
  handT: UiToggleElement
  zoomIcon: HTMLElement
  grip: HTMLButtonElement
  back: HTMLButtonElement
  forward: HTMLButtonElement
  full: HTMLButtonElement
  seek: UiSliderElement
  seekThumb: HTMLElement
  hand: HTMLButtonElement
  live: HTMLButtonElement
  target: HTMLButtonElement
  title: HTMLElement
}

export type Tile = {
  id: string
  el: HTMLElement
  player: YT.Player | null
  reveal: () => void
  /** 枠を外すときに、イベントの受け取りやタイマーを止める */
  dispose: () => void
  /** 自分で一時停止した(自動で再生し直さない) */
  userPaused: boolean
  playing: boolean
  isLive: boolean
  /** ライブから遅れている秒数 */
  delay: number
  behind: number
  lastSample: Sample | null
  ui: TileUi
}

export type State = {
  ids: string[]
  tiles: Map<string, Tile>
  titles: Map<string, string>
  audioId: string | null
  layoutMode: LayoutMode
  focusId: string | null
  moveSource: string | null
  chatId: string | null
  ytReady: boolean
  seq: number
  lastInputWasKeyboard: boolean
}

export const initialState = (): State => ({
  ids: [],
  tiles: new Map(),
  titles: new Map(),
  audioId: null,
  layoutMode: "auto",
  focusId: null,
  moveSource: null,
  chatId: null,
  ytReady: false,
  seq: 0,
  lastInputWasKeyboard: false
})

/** 画面の部品どうしが呼び合う操作。各モジュールは型だけを参照し、組み立ては program.ts で行う */
export interface App {
  readonly state: State
  readonly board: SortableElement
  readonly list: SortableElement
  readonly save: (key: SettingKey, value: string) => void
  readonly load: (key: SettingKey, fallback: string) => string
  readonly createPlayer: (elementId: string, options: YT.PlayerOptions) => YT.Player
  persist(): void
  setOrder(next: readonly string[]): void
  layout(): void
  renderLayoutChoices(): void
  paint(): void
  render(): void
  renderList(): void
  renderChatChoices(): void
  setChat(open: boolean): void
  setAudio(id: string): void
  setPaused(tile: Tile, paused: boolean): void
  toggleFocus(id: string): void
  toLive(tile: Tile): void
  startMove(id: string): void
  cancelMove(message?: string): void
  finishMove(targetId: string): void
  openDialog(): void
}

export type SettingKey = "mv-ids" | "mv-layout" | "mv-focus" | "mv-yt" | "mv-chat" | "mv-seen"

export const allPaused = (state: State): boolean => state.tiles.size > 0 && [...state.tiles.values()].every((t) => t.userPaused)

export const ytControls = (): boolean => document.body.classList.contains("yt-controls")
