import { expect, test } from "vitest"
import { checkAddition, focusedId, MAX, movedTo, nameOf, parseIds, parseLayout, shifted, watchUrl } from "./lineup"

const id = (n: number) => `video${String(n).padStart(6, "0")}`

test("保存した並べ方を読む。読めない値と以前の版の 0 は自動", () => {
  expect(parseLayout("focus")).toBe("focus")
  expect(parseLayout("3")).toBe(3)
  expect(parseLayout("auto")).toBe("auto")
  expect(parseLayout("0")).toBe("auto")
  expect(parseLayout("-2")).toBe("auto")
  expect(parseLayout("1.5")).toBe("auto")
  expect(parseLayout("")).toBe("auto")
})

test("並べる動画は、読めないIDと重複を除き、上限までにする", () => {
  expect(parseIds(`${id(1)},bad,${id(2)},${id(1)}`)).toEqual([id(1), id(2)])
  expect(parseIds("")).toEqual([])
  expect(parseIds(Array.from({ length: MAX + 3 }, (_, i) => id(i)).join(","))).toHaveLength(MAX)
})

test("追加するURLを確かめる", () => {
  expect(checkAddition(`https://youtu.be/${id(1)}`, [])).toEqual({ id: id(1) })
  expect(checkAddition("  ", [])).toEqual({ error: "URLを入れてください。" })
  expect(checkAddition("https://example.com/", [])).toHaveProperty("error", expect.stringContaining("読み取れません"))
  expect(checkAddition(id(1), [id(1)])).toEqual({ error: "この動画はもう並んでいます。" })
  const full = Array.from({ length: MAX }, (_, i) => id(i + 10))
  expect(checkAddition(id(1), full)).toHaveProperty("error", expect.stringContaining(`${MAX}つまで`))
  expect(checkAddition(id(1), full.slice(1))).toEqual({ id: id(1) })
})

test("前後に1つ動かす。端より外へは動かさない", () => {
  const ids = ["a", "b", "c"]
  expect(shifted(ids, "a", 1)).toEqual(["b", "a", "c"])
  expect(shifted(ids, "c", -1)).toEqual(["a", "c", "b"])
  expect(shifted(ids, "a", -1)).toBeNull()
  expect(shifted(ids, "c", 1)).toBeNull()
  expect(shifted(ids, "x", 1)).toBeNull()
  expect(ids).toEqual(["a", "b", "c"])
})

test("選んだ動画を、移動先の動画の位置へ動かす", () => {
  expect(movedTo(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"])
  expect(movedTo(["a", "b", "c", "d"], "d", "a")).toEqual(["d", "a", "b", "c"])
})

test("大きく表示する動画は、選んだ動画、音声を出している動画、先頭の動画の順に決める", () => {
  const state = { ids: ["a", "b", "c"], titles: new Map<string, string>(), audioId: null as string | null, focusId: null as string | null }
  expect(focusedId(state)).toBe("a")
  state.audioId = "c"
  expect(focusedId(state)).toBe("c")
  state.focusId = "b"
  expect(focusedId(state)).toBe("b")
  state.focusId = "gone"
  expect(focusedId(state)).toBe("c")
  state.audioId = "gone"
  expect(focusedId(state)).toBe("a")
})

test("動画の名前は、タイトルが分かるまでは並び順の番号", () => {
  const state = { ids: ["a", "b"], titles: new Map<string, string>() }
  expect(nameOf(state, "b")).toBe("動画2")
  state.titles.set("b", "決勝")
  expect(nameOf(state, "b")).toBe("決勝")
})

test("動画ページのURL", () => {
  expect(watchUrl("abcDEF_-123")).toBe("https://www.youtube.com/watch?v=abcDEF_-123")
})
