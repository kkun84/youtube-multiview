import { expect, test } from "vitest"
import { liveTarget, nextDelay, visibleDelay, type Sample } from "./live-delay"

/** 2秒おきに計測したときの遅れを順に計算する。true は再生中 */
function run(states: boolean[]): number {
  let delay = 0
  let prev: Sample | null = null
  states.forEach((playing, i) => {
    const now = { at: i * 2, playing }
    delay = nextDelay(delay, prev, now)
    prev = now
  })
  return delay
}

test("再生している間は、何分たっても遅れない", () => {
  expect(run(Array.from({ length: 300 }, () => true))).toBe(0)
})

test("止まり続けていた時間が遅れになる", () => {
  expect(run([true, false, false, false, false, true])).toBe(6)
})

test("計測のあいだの短い読み込み待ちは数えない", () => {
  expect(run([true, false, true, false, true])).toBe(0)
})

test("止まるたびに遅れが積み上がり、再生を再開しても減らない", () => {
  expect(run([true, false, false, true, true, false, false, false, true])).toBe(6)
})

test("最初の計測では遅れを足さない", () => {
  expect(nextDelay(0, null, { at: 100, playing: false })).toBe(0)
})

test("15秒を超えるまでは表示しない", () => {
  expect(visibleDelay(14)).toBe(0)
  expect(visibleDelay(20)).toBe(20)
})

test("最新の位置へは、配信の長さと「今の位置+遅れ」の大きい方の少し手前へ移る", () => {
  expect(liveTarget(7058, 6935, 120)).toBe(7056)
  // 配信の長さが古いまま今の位置より短いときは、今の位置に遅れを足した方を使う
  expect(liveTarget(6966, 7052, 30)).toBe(7080)
})
