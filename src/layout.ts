export type Rect = { x: number; y: number; w: number; h: number }

/** 並び方。"auto" は一番大きく映る列数、数値はその列数、"focus" は1つを大きく */
export type LayoutMode = "auto" | number | "focus"

const RATIO = 16 / 9

// 段の数が変わる列数だけを選択肢にする(4つなら1・2・4列。3列だと3つと1つの中途半端な並びになる)
export function colChoices(n: number): number[] {
  const out: number[] = []
  let prev = 0
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c)
    if (rows !== prev) {
      out.push(c)
      prev = rows
    }
  }
  return out
}

export function gridRects(n: number, cols: number, W: number, H: number, gap: number): { size: number; rects: Rect[] } {
  const rows = Math.ceil(n / cols)
  const w = Math.max(0, Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * RATIO))
  const h = w / RATIO
  const ox = (W - (w * cols + gap * (cols - 1))) / 2
  const oy = (H - (h * rows + gap * (rows - 1))) / 2
  const rects = Array.from({ length: n }, (_, i) => ({
    x: ox + (i % cols) * (w + gap),
    y: oy + Math.floor(i / cols) * (h + gap),
    w,
    h,
  }))
  return { size: w, rects }
}

// 1つを大きく、残りを下の段か右の列に小さく並べる。大きい方が広く映る置き方を選ぶ。先頭が大きい枠
export function focusRects(n: number, W: number, H: number, gap: number): Rect[] {
  if (n < 2) return gridRects(n, 1, W, H, gap).rects
  const m = n - 1
  const plans: { area: number; rects: Rect[] }[] = []
  {
    let sw = (W - gap * (m - 1)) / m
    let sh = sw / RATIO
    if (sh > H * 0.3) {
      sh = H * 0.3
      sw = sh * RATIO
    }
    const mw = Math.min(W, (H - sh - gap) * RATIO)
    const mh = mw / RATIO
    const oy = (H - (mh + gap + sh)) / 2
    const rowW = sw * m + gap * (m - 1)
    plans.push({
      area: mw * mh,
      rects: [
        { x: (W - mw) / 2, y: oy, w: mw, h: mh },
        ...Array.from({ length: m }, (_, i) => ({ x: (W - rowW) / 2 + i * (sw + gap), y: oy + mh + gap, w: sw, h: sh })),
      ],
    })
  }
  {
    let sh = (H - gap * (m - 1)) / m
    let sw = sh * RATIO
    if (sw > W * 0.3) {
      sw = W * 0.3
      sh = sw / RATIO
    }
    const mh = Math.min(H, (W - sw - gap) / RATIO)
    const mw = mh * RATIO
    const ox = (W - (mw + gap + sw)) / 2
    const colH = sh * m + gap * (m - 1)
    plans.push({
      area: mw * mh,
      rects: [
        { x: ox, y: (H - mh) / 2, w: mw, h: mh },
        ...Array.from({ length: m }, (_, i) => ({ x: ox + mw + gap, y: (H - colH) / 2 + i * (sh + gap), w: sw, h: sh })),
      ],
    })
  }
  return plans.sort((a, b) => b.area - a.area)[0]!.rects
}

/** 並び順の i 番目の動画を置く枠。focus のときも並び順は変えず、選んだ動画だけを大きい枠に入れる */
export function arrange(ids: readonly string[], mode: LayoutMode, focused: string | undefined, W: number, H: number, gap: number): Rect[] {
  const n = ids.length
  if (!n) return []
  if (mode === "focus") {
    const [main, ...small] = focusRects(n, W, H, gap)
    return ids.map((id) => (id === focused ? main! : small.shift()!))
  }
  if (typeof mode === "number") return gridRects(n, mode, W, H, gap).rects
  return colChoices(n)
    .map((c) => gridRects(n, c, W, H, gap))
    .sort((a, b) => b.size - a.size)[0]!.rects
}
