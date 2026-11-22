import { describe, expect, test } from "vitest"
import { arrange, colChoices, focusRects, layoutChoices, packTop } from "./layout"

const ids = ["a", "b", "c", "d"]

describe("colChoices", () => {
  test("段の数が変わる列数だけを返す", () => {
    expect(colChoices(4)).toEqual([1, 2, 4])
    expect(colChoices(5)).toEqual([1, 2, 3, 5])
    expect(colChoices(1)).toEqual([1])
  })
})

describe("arrange", () => {
  test("iPhoneの縦では1列に並ぶ", () => {
    const rects = arrange(ids, "auto", undefined, 382, 700, 4)
    expect(new Set(rects.map((r) => r.x)).size).toBe(1)
  })

  test("iPadの横では2×2に並ぶ", () => {
    const rects = arrange(ids, "auto", undefined, 1172, 760, 4)
    expect(new Set(rects.map((r) => r.x)).size).toBe(2)
    expect(new Set(rects.map((r) => r.y)).size).toBe(2)
  })

  test("左上から右下へ、並び順のとおりに置く", () => {
    const rects = arrange(ids, 2, undefined, 1172, 760, 4)
    expect(rects[0]!.x).toBeLessThan(rects[1]!.x)
    expect(rects[1]!.y).toBeLessThan(rects[2]!.y)
  })

  test("どの枠も16:9で、画面からはみ出さない", () => {
    for (const mode of ["auto", 1, 2, 4, "focus"] as const) {
      for (const [W, H] of [
        [382, 700],
        [812, 1100],
        [1172, 760]
      ] as const) {
        for (const r of arrange(ids, mode, "c", W, H, 4)) {
          expect(r.w / r.h).toBeCloseTo(16 / 9, 5)
          expect(r.x).toBeGreaterThanOrEqual(-0.01)
          expect(r.y).toBeGreaterThanOrEqual(-0.01)
          expect(r.x + r.w).toBeLessThanOrEqual(W + 0.01)
          expect(r.y + r.h).toBeLessThanOrEqual(H + 0.01)
        }
      }
    }
  })

  test("大きく表示しても並び順は変えず、選んだ動画だけが大きい枠になる", () => {
    const rects = arrange(ids, "focus", "c", 1172, 760, 4)
    const [main] = focusRects(4, 1172, 760, 4)
    expect(rects[2]).toEqual(main)
    const small = [rects[0]!, rects[1]!, rects[3]!]
    expect(small.every((r) => r.w < main!.w)).toBe(true)
    // 小さい枠は元の並び順のまま左から(または上から)並ぶ
    expect(small[0]!.x + small[0]!.y).toBeLessThan(small[1]!.x + small[1]!.y)
    expect(small[1]!.x + small[1]!.y).toBeLessThan(small[2]!.x + small[2]!.y)
  })
})

test("並べ方の選択肢は、動画の数に合わせて増える", () => {
  expect(layoutChoices(1)).toEqual([["auto", "自動"]])
  expect(layoutChoices(2)).toEqual([
    ["auto", "自動"],
    [1, "1列"],
    [2, "横一列"]
  ])
  expect(layoutChoices(4).map(([, label]) => label)).toEqual(["自動", "1列", "2列", "横一列", "大きく"])
})

test("枠を上端に詰め、全体の高さを返す", () => {
  const rects = [
    { x: 0, y: 50, w: 160, h: 90 },
    { x: 0, y: 144, w: 160, h: 90 }
  ]
  expect(packTop(rects)).toEqual({
    rects: [
      { x: 0, y: 0, w: 160, h: 90 },
      { x: 0, y: 94, w: 160, h: 90 }
    ],
    height: 184
  })
  expect(packTop([])).toEqual({ rects: [], height: 0 })
})
