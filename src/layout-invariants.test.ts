import { describe, expect, test } from "vitest"
import { arrange, focusRects, type LayoutMode, type Rect } from "./layout"

const GAP = 4
const SCREENS = [
  { name: "iPhone縦", W: 382, H: 742 },
  { name: "iPad縦", W: 812, H: 1076 },
  { name: "iPad横", W: 1172, H: 716 },
  { name: "横長", W: 1600, H: 500 }
] as const
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const ids = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`)
const EPS = 1e-6

function expectInside(rects: readonly Rect[], W: number, H: number) {
  for (const r of rects) {
    expect(r.x).toBeGreaterThanOrEqual(-EPS)
    expect(r.y).toBeGreaterThanOrEqual(-EPS)
    expect(r.x + r.w).toBeLessThanOrEqual(W + EPS)
    expect(r.y + r.h).toBeLessThanOrEqual(H + EPS)
    expect(r.w).toBeGreaterThan(0)
    expect(r.w / r.h).toBeCloseTo(16 / 9, 6)
  }
}

/** どの2つも、横か縦のどちらかにすき間の幅以上離れている */
function expectApart(rects: readonly Rect[]) {
  rects.forEach((a, i) => {
    for (const b of rects.slice(i + 1)) {
      const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
      const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
      expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(GAP - EPS)
    }
  })
}

/** 全体が画面の中央にある */
function expectCentered(rects: readonly Rect[], W: number, H: number) {
  const left = Math.min(...rects.map((r) => r.x))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const top = Math.min(...rects.map((r) => r.y))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  expect(left).toBeCloseTo(W - right, 6)
  expect(top).toBeCloseTo(H - bottom, 6)
}

/** 縦か横のどちらかは、画面いっぱいまで使っている */
function expectFills(rects: readonly Rect[], W: number, H: number) {
  const width = Math.max(...rects.map((r) => r.x + r.w)) - Math.min(...rects.map((r) => r.x))
  const height = Math.max(...rects.map((r) => r.y + r.h)) - Math.min(...rects.map((r) => r.y))
  expect(Math.min(W - width, H - height)).toBeLessThan(1e-6)
}

describe.each(SCREENS)("$name", ({ W, H }) => {
  describe.each(COUNTS)("%i個", (n) => {
    const modes: LayoutMode[] = ["auto", 1, n, "focus"]
    test.each(modes)("並べ方 %s で、枠は画面の中に重ならず中央に並ぶ", (mode) => {
      const rects = arrange(ids(n), mode, "v0", W, H, GAP)
      expect(rects).toHaveLength(n)
      expectInside(rects, W, H)
      expectApart(rects)
      expectCentered(rects, W, H)
    })

    test("自動と列数指定では、全部同じ大きさで画面いっぱいまで使う", () => {
      for (const mode of ["auto", 1, n] as const) {
        const rects = arrange(ids(n), mode, undefined, W, H, GAP)
        for (const r of rects) expect(r.w).toBeCloseTo(rects[0]!.w, 6)
        expectFills(rects, W, H)
      }
    })

    test("自動は、列数を指定したどの並べ方よりも小さくならない", () => {
      const auto = arrange(ids(n), "auto", undefined, W, H, GAP)[0]!.w
      for (let cols = 1; cols <= n; cols += 1) {
        expect(auto).toBeGreaterThanOrEqual(arrange(ids(n), cols, undefined, W, H, GAP)[0]!.w - EPS)
      }
    })
  })

  describe.each(COUNTS.filter((n) => n >= 2))("大きく表示 %i個", (n) => {
    const [main, ...small] = focusRects(n, W, H, GAP)

    test("大きい枠は小さい枠より大きく、小さい枠は全部同じ大きさ", () => {
      for (const r of small) {
        expect(main!.w).toBeGreaterThan(r.w)
        expect(r.w).toBeCloseTo(small[0]!.w, 6)
      }
    })

    test("小さい枠は、大きい枠の下に横一列か、右に縦一列で、すき間の幅だけ空けて順に並ぶ", () => {
      const below = small.every((r) => Math.abs(r.y - (main!.y + main!.h + GAP)) < EPS)
      const beside = small.every((r) => Math.abs(r.x - (main!.x + main!.w + GAP)) < EPS)
      expect(below || beside).toBe(true)
      small.slice(1).forEach((r, i) => {
        const prev = small[i]!
        const step = below ? r.x - (prev.x + prev.w) : r.y - (prev.y + prev.h)
        expect(step).toBeCloseTo(GAP, 6)
      })
    })

    test("小さい枠は、並ぶ向きに画面の半分まで、それと直角の向きに3割までで、その範囲でいちばん大きい", () => {
      const below = Math.abs(small[0]!.y - (main!.y + main!.h + GAP)) < EPS
      const across = below ? small[0]!.h / H : small[0]!.w / W
      const each = below ? small[0]!.w / W : small[0]!.h / H
      const along = below ? small[0]!.w * small.length + GAP * (small.length - 1) : small[0]!.h * small.length + GAP * (small.length - 1)
      expect(across).toBeLessThanOrEqual(0.3 + EPS)
      expect(each).toBeLessThanOrEqual(0.5 + EPS)
      const limits = [Math.abs(across - 0.3), Math.abs(each - 0.5), Math.abs(along - (below ? W : H))]
      expect(Math.min(...limits)).toBeLessThan(EPS)
    })

    test("大きい枠は、残りの場所でいちばん大きい", () => {
      const below = Math.abs(small[0]!.y - (main!.y + main!.h + GAP)) < EPS
      const fillsWidth = Math.abs(main!.w - (below ? W : W - small[0]!.w - GAP)) < EPS
      const fillsHeight = Math.abs(main!.h - (below ? H - small[0]!.h - GAP : H)) < EPS
      expect(fillsWidth || fillsHeight).toBe(true)
    })

    test("縦長の画面では小さい枠が下に、横長の画面では右に来る", () => {
      const below = Math.abs(small[0]!.y - (main!.y + main!.h + GAP)) < EPS
      if (H > W) expect(below).toBe(true)
      if (W > H * 3) expect(below).toBe(false)
    })

    test("選んだ動画が大きい枠に入り、残りは並び順のまま小さい枠に入る", () => {
      const focused = `v${n - 1}`
      const rects = arrange(ids(n), "focus", focused, W, H, GAP)
      expect(rects[n - 1]).toEqual(main)
      expect(rects.slice(0, n - 1)).toEqual(small)
    })
  })
})

test("動画がなければ枠もない", () => {
  expect(arrange([], "auto", undefined, 800, 600, GAP)).toEqual([])
  expect(arrange([], "focus", undefined, 800, 600, GAP)).toEqual([])
})

test("1つだけを大きく表示しても、普通の1つと同じ枠になる", () => {
  expect(focusRects(1, 800, 600, GAP)).toEqual(arrange(["a"], "auto", undefined, 800, 600, GAP))
})
