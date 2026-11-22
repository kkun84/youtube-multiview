// プライベートブラウズなどで localStorage が使えないときも、保存できないだけで動くようにする
export const storage = {
  get(key: string, fallback: string): string {
    try {
      return localStorage.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // 保存できなくても続ける
    }
  }
}
