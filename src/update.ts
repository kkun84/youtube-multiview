import { announce } from "@ui-sdk/core"

// ホーム画面のアプリは終了されにくく、古い版を表示し続ける。前面に戻ったときと数分おきに、公開中の版番号を確かめる

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" })
    const data: unknown = await res.json()
    return typeof data === "object" && data && "version" in data && typeof data.version === "string" ? data.version : null
  } catch {
    return null
  }
}

export function setupUpdates(bar: HTMLElement, updateButton: HTMLElement, checkButton: HTMLElement, versionText: HTMLElement): void {
  const check = async (manual = false) => {
    const latest = await latestVersion()
    if (latest && latest !== __APP_VERSION__) {
      bar.hidden = false
      if (manual) announce("新しい版があります")
    } else if (manual) {
      announce(latest ? "最新版です" : "確認できませんでした。ネットワークを確かめてください")
    }
  }
  // HTMLもキャッシュされているので、URLを変えて読み込み直す
  updateButton.addEventListener("click", () => location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`))
  checkButton.addEventListener("click", () => void check(true))
  versionText.textContent = `版: ${__APP_VERSION__}`
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check()
  })
  setInterval(() => void check(), 5 * 60 * 1000)
  void check()
}
