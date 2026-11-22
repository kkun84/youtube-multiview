// ライブ配信の getDuration() と getCurrentTime() の差は、追いついていても数十秒単位で揺れるので遅れの計算に使えない。
// 代わりに、経過した時間に対して再生位置がどれだけ進まなかったか(一時停止・読み込み待ち・巻き戻し)を足し合わせて遅れとする

export type Sample = { position: number; at: number }

/** 再生位置の揺れとみなして無視するずれ(秒) */
const JITTER = 1.5

/** 遅れとして表示し始める秒数 */
export const SHOW_AFTER = 15

/** 前回の計測からの時計の進みと再生位置の進みを比べ、遅れ(秒)を更新する */
export function nextDelay(delay: number, prev: Sample | null, now: Sample, rate = 1): number {
  if (!prev) return delay
  const drift = prev.position + (now.at - prev.at) * rate - now.position
  return Math.abs(drift) > JITTER ? Math.max(0, delay + drift) : delay
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
