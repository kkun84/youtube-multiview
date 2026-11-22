import { Effect, Layer } from "effect"
import { expect, test } from "vitest"
import { Settings } from "./settings"

const memory = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  }
}

const broken = (): Storage => {
  throw new DOMException("denied", "SecurityError")
}

const run = <A>(layer: Layer.Layer<Settings>, effect: Effect.Effect<A, never, Settings>) => Effect.runSync(Effect.provide(effect, layer))

test("保存した値を読み出せる。保存していなければ既定の値", () => {
  const layer = Settings.fromStorage(() => memory())
  const shared = memory()
  const sharedLayer = Settings.fromStorage(() => shared)
  expect(
    run(
      layer,
      Settings.use((s) => s.get("mv-layout", "auto"))
    )
  ).toBe("auto")
  run(
    sharedLayer,
    Settings.use((s) => s.set("mv-layout", "focus"))
  )
  expect(
    run(
      sharedLayer,
      Settings.use((s) => s.get("mv-layout", "auto"))
    )
  ).toBe("focus")
})

test("保存先が使えないときも止まらず、既定の値を返す", () => {
  const layer = Settings.fromStorage(broken)
  expect(
    run(
      layer,
      Settings.use((s) => s.set("mv-ids", "abc"))
    )
  ).toBeUndefined()
  expect(
    run(
      layer,
      Settings.use((s) => s.get("mv-ids", "既定"))
    )
  ).toBe("既定")
})
