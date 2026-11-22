import { Effect, Option } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { latestVersion } from "./version-check"

afterEach(() => vi.unstubAllGlobals())

const respond = (body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body))))

describe("latestVersion", () => {
  it("公開中の版番号を返す", async () => {
    respond({ version: "20261122-120000" })
    expect(await Effect.runPromise(latestVersion)).toEqual(Option.some("20261122-120000"))
  })
  it("版番号の形が違えば None", async () => {
    respond({ version: 1 })
    expect(await Effect.runPromise(latestVersion)).toEqual(Option.none())
  })
  it("通信に失敗したら None", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))))
    expect(await Effect.runPromise(latestVersion)).toEqual(Option.none())
  })
})
