// ライブ配信の getDuration() と getCurrentTime() は、追いついていても数十秒単位で揺れたり、端末によっては進まなかったりするので遅れの計算に使えない。
// 代わりに、再生が止まっていた時間(一時停止・読み込み待ち)を時計で測って足し合わせ、遅れとする

export type Sample = { at: number; playing: boolean }

/** 遅れとして表示し始める秒数 */
const SHOW_AFTER = 15

/** 前回の計測から今回まで止まり続けていたら、その間の秒数を遅れに足す。計測のあいだの短い読み込み待ちは数えない */
export function nextDelay(delay: number, prev: Sample | null, now: Sample): number {
  if (!prev || prev.playing || now.playing) return delay
  return delay + Math.max(0, now.at - prev.at)
}

export const visibleDelay = (delay: number): number => (delay > SHOW_AFTER ? delay : 0)

/**
 * 最新の位置へ移るときの移動先(秒)。
 * 配信の長さは更新が遅れて今の再生位置より短いことがあるので、今の位置に数えておいた遅れを足した値と比べて大きい方を使う。
 * 配信によって配信の長さと再生位置の基準が違い、配信の長さが最新の位置より先を指すことがある。その場合もYouTubeが最新の位置に止める
 */
export function liveTarget(duration: number, position: number, delay: number): number {
  return Math.max(duration, position + delay) - 2
}
