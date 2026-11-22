import { Context, Effect, Layer } from "effect"
import type { SettingKey } from "./model"

/** 設定の保存先。プライベートブラウズなどで保存できないときも、保存できないだけで動くようにする */
export class Settings extends Context.Service<
  Settings,
  {
    readonly get: (key: SettingKey, fallback: string) => Effect.Effect<string>
    readonly set: (key: SettingKey, value: string) => Effect.Effect<void>
  }
>()("Settings") {
  static readonly fromStorage = (storage: () => Storage): Layer.Layer<Settings> =>
    Layer.succeed(this, {
      get: (key, fallback) =>
        Effect.try(() => storage().getItem(key)).pipe(
          Effect.map((value) => value ?? fallback),
          Effect.orElseSucceed(() => fallback)
        ),
      set: (key, value) => Effect.try(() => storage().setItem(key, value)).pipe(Effect.ignore)
    })

  static readonly browser: Layer.Layer<Settings> = Settings.fromStorage(() => localStorage)
}
