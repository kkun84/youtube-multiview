import { expect, test } from "vitest"
import { nextDelay, visibleDelay } from "./live-delay"

/** 2秒おきに計測したときの遅れを順に計算する */
function run(positions: number[], rate = 1): number {
  let delay = 0
  let prev = null as { position: number; at: number } | null
  positions.forEach((position, i) => {
    const now = { position, at: i * 2 }
    delay = nextDelay(delay, prev, now, rate)
    prev = now
  })
  return delay
}

test("普通に再生している間は遅れない", () => {
  expect(run([100, 102, 104, 106, 108])).toBe(0)
})

test("小さな揺れは遅れに数えない", () => {
  expect(run([100, 102.5, 103.8, 106.4, 108])).toBe(0)
})

test("一時停止した時間がそのまま遅れになる", () => {
  expect(run([100, 102, 102, 102, 102, 104])).toBe(6)
})

test("巻き戻すと遅れ、早送りで取り戻すと減る", () => {
  expect(run([100, 102, 74, 76])).toBe(30)
  expect(run([100, 102, 74, 76, 108])).toBe(0)
})

test("遅れは0より小さくならない", () => {
  expect(run([100, 140, 142])).toBe(0)
})

test("15秒を超えるまでは表示しない", () => {
  expect(visibleDelay(14)).toBe(0)
  expect(visibleDelay(20)).toBe(20)
})
