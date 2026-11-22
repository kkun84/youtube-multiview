import { createChange, createReorder, definePrimitive, reorderMessage, type ReorderDraft, type ReorderMessage } from "@ui-sdk/core"
import { createParts, wrappedButton } from "@ui-sdk/web"

type SortableOptions = {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  /** 読み上げに使う動画の名前 */
  labelOf?: (key: string) => string
  orientation?: "grid" | "vertical"
}

function reorderText(m: ReorderMessage): string {
  switch (m.type) {
    case "grab":
      return `${m.label}を持ち上げました。${m.total}個中${m.position}番目です。矢印キーで動かし、スペースキーで置きます。`
    case "move":
      return `${m.total}個中${m.position}番目`
    case "drop":
      return `${m.label}を${m.position}番目に置きました。`
    case "cancel":
      return "移動を取り消しました。"
    default:
      return reorderMessage(m)
  }
}

// 並べ替えはUI SDKのcreateReorderに任せる。iframeは動かすと読み込み直しになるので、DOMの順番は変えず、data-indexで表示位置だけを変える
const sortable = definePrimitive({
  name: "sortable-board",
  options: {
    value: "list",
    defaultValue: "list",
    onValueChange: "callback",
    labelOf: "value",
    orientation: "string"
  },
  controlled: ["value"],
  state: (o: SortableOptions) => ({ value: o.value ?? o.defaultValue ?? [], moving: null as ReorderDraft | null }),
  sync: (o: SortableOptions) => (o.value === undefined ? {} : { value: o.value }),
  api: (context) => {
    const change = createChange(context)
    const reorder = createReorder(context, {
      slot: "tile",
      key: "value",
      draft: "moving",
      set: (value, details) => change("value", value, details),
      orientation: () => context.options().orientation ?? "grid",
      label: (key) => context.options().labelOf?.(key),
      message: reorderText
    })
    return { reorder, move: (key: string, index: number) => reorder.move(key, index) }
  },
  slots: (slot) => ({
    root: slot({ role: "list" }),
    tile: slot<{ value: string }>({
      props: { value: "key" },
      role: "listitem",
      attrs: (state, part) => ({
        "data-index": String(part.api.reorder.order(state).indexOf(part.key)),
        "data-grabbed": part.api.reorder.moving(state, part.key) ? "" : undefined,
        "data-dragging": part.api.reorder.dragging(state, part.key) ? "" : undefined
      }),
      bind: (el, part) => part.api.reorder.bind(el, part)
    }),
    handle: slot<{ value: string }>({
      props: { value: { kind: "key", from: "tile", required: true } },
      role: "button",
      focus: "native",
      press: { none: "Space and Enter pick the tile up in keydown, and a pointer drags it in pointerdown." },
      attrs: (state, part) => ({ "aria-pressed": String(part.api.reorder.moving(state, part.key)) }),
      on: {
        keydown: (event, { api, key }) => {
          api.reorder.keydown(event as KeyboardEvent, key)
        },
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event as PointerEvent, key)
      }
    })
  }),
  agent: { actions: ["move"] }
})

createParts(sortable, {
  root: "mv-board",
  tile: "mv-tile",
  handle: { tag: "mv-handle", target: wrappedButton, display: "contents" }
})

// 一覧画面の並べ替えにも同じ部品を使う。縦に並ぶので orientation="vertical" にする
createParts(sortable, {
  root: "mv-list",
  tile: "mv-list-item",
  handle: { tag: "mv-list-handle", target: wrappedButton, display: "contents" }
})

/** mv-board と mv-list の要素。value と labelOf はプロパティで渡す */
export type SortableElement = HTMLElement & {
  value: string[]
  labelOf?: (key: string) => string
}
