import { Data, Effect, Option, Schema } from "effect"

const VersionFile = Schema.Struct({ version: Schema.String })

class VersionFetchError extends Data.TaggedError("VersionFetchError")<{ cause: unknown }> {}

/** 公開中の版番号。取れなかったときは None */
export const latestVersion: Effect.Effect<Option.Option<string>> = Effect.tryPromise({
  try: (signal) => fetch(`./version.json?t=${Date.now()}`, { cache: "no-store", signal }).then((res) => res.json() as Promise<unknown>),
  catch: (cause) => new VersionFetchError({ cause }),
}).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(VersionFile)),
  Effect.map((file) => file.version),
  Effect.timeoutOption("10 seconds"),
  Effect.catch(() => Effect.succeed(Option.none<string>())),
)
