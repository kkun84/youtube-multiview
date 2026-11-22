import type { UiChangeEvent } from "@ui-sdk/web"
import { Effect, type Scope } from "effect"

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.querySelector<T>(`#${CSS.escape(id)}`)
  if (!el) throw new Error(`#${id} がありません`)
  return el
}

export const q = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`${selector} がありません`)
  return el
}

/** イベントを受け取る。スコープが閉じたら受け取りをやめる */
export const listen = <E extends Event = Event>(
  target: EventTarget,
  type: string,
  handler: (event: E) => void,
  options?: AddEventListenerOptions
): Effect.Effect<void, never, Scope.Scope> => {
  const listener = (event: Event) => handler(event as E)
  return Effect.acquireRelease(
    Effect.sync(() => target.addEventListener(type, listener, options)),
    () => Effect.sync(() => target.removeEventListener(type, listener, options))
  )
}

/** UI SDKのトグルを人が押したときだけ受け取る(コードから pressed を変えたときは受け取らない) */
export const onPress = (el: HTMLElement, handler: (pressed: boolean) => void): Effect.Effect<void, never, Scope.Scope> =>
  listen<UiChangeEvent<boolean, string>>(el, "pressedchange", (event) => {
    const { value, reason } = event.detail
    if (reason === "press") handler(value)
  })

/** 部品が使えるようになってから値を入れる */
export function whenDefined(tag: string, run: () => void): void {
  void customElements.whenDefined(tag).then(run, () => null)
}
