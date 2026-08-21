# Changelog

## 5.1.1

### Patch Changes

- [`41903a4`](https://github.com/parziva-1/zod-mongoose/commit/41903a49db96557be2a6a16c2152a8596e470d59) - Fix `toPartialUpdateSchema()`'s inferred output type: each field now keeps its specific Zod type (enum literal union, string, number, nested object, ...) instead of collapsing to a generic `ZodType`. Runtime behavior is unchanged — this only fixes TypeScript inference, which was severe enough to break real call sites (e.g. `body.status` inferring as `{}`, which broke `allowed.includes(body.status)` when adopting this in spybee-backend-v3-hono).

## 5.1.0

### Minor Changes

- [`90e44ae`](https://github.com/parziva-1/zod-mongoose/commit/90e44ae0c00a82a6af5af2eaebb737b9391a80b1) - Add `toPartialUpdateSchema()` to safely build a PUT/PATCH request-body schema from a full model schema.
  
  Reusing a model field directly as `ModelSchema.shape.field.optional()` (or calling `.partial()` on the whole model schema) for a partial-update body looks safe but isn't under Zod v4: chaining `.optional()` onto a `ZodDefault` does not make an absent field parse to `undefined` — it still applies the inner default. A handler that then mass-writes the parsed body (`doc.set(body)`, `Model.findByIdAndUpdate(id, body)`, ...) ends up silently resetting every omitted defaulted field back to its default value on every partial update, clobbering whatever was actually stored.
  
  `toPartialUpdateSchema(schema)` walks a model schema's fields, strips any `.default()` wherever it appears in the chain (including nested inside `.optional()`/`.nullable()`), and re-wraps each field in `.optional()` — so an absent field genuinely means "leave unchanged" downstream.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased
### Fixed
- **`.optional().default(x)` no longer silently drops the Mongoose
  `default`.** `parseField`'s `ZodOptional` branch discarded whatever `def`
  had been passed down from an outer `.default()`, so the default only
  survived when `.default()` came after `.optional()` in the chain. It now
  forwards `def` through regardless of chain order (including deeper
  chains like `.optional().nullable().default(null)`).
- **`zId()`/`zUUID()` fields now honor `.default()`, in any chain order.**
  The ObjectId/UUID branches of `parseField` never accepted or forwarded a
  `def` argument at all, so e.g. `zId().ref('X').nullable().default(null)`
  always ended up `undefined` instead of `null`. `parseObjectId`/
  `parseUUID` now accept and apply a `default`. (Also fixed an adjacent
  copy-paste bug where the UUID branch read `__zm_unique` twice instead of
  `__zm_sparse` for its `sparse` flag.)
- **A nested `z.object().default({})` now applies its Mongoose default.**
  The `ZodObject` branch of `parseField` never accepted or forwarded `def`
  either, so e.g. `metadata: SomeSchema.default({})` always ended up
  `undefined`. `parseObject` now accepts a `def` and wraps the subdocument
  in the `{ type, default, required }` form whenever one is present.
- **`z.record()`/`z.map()` with a union value type no longer silently
  corrupts data.** The value type was routed through the generic union
  handling, which picks the first union member's type - for
  `z.record(z.string(), z.union([z.string(), z.number()]))` that silently
  coerced numeric values to strings via Mongoose's `Map`/`String` casting
  on save. The value type is now stored as `Schema.Types.Mixed` with a
  `validate` re-checking each value against the original union schema, so
  every member's actual type round-trips untouched and out-of-union values
  are rejected instead of silently coerced. (The Zod v3→v4 `z.record()`
  single-vs-two-argument signature change is a consumer-facing API note,
  not an internal bug here - Zod v4's `z.record()` already accepts both the
  single-argument form, defaulting `keyType` to `z.string()`, and the
  two-argument form; this library reads `_zod.def.valueType`/`.valueType`
  correctly either way.)

## 5.0.0 - 2026-08-20
### Breaking
- **BREAKING: package renamed to `@parziva-1/zod-mongoose`.** This fork is now
  published independently of the upstream `@zodyac/zod-mongoose` scope.
  Update your imports from `@zodyac/zod-mongoose` to `@parziva-1/zod-mongoose`.
- **BREAKING: package is now ESM-only.** The CJS build has been dropped;
  `require()` is no longer supported. CommonJS consumers should use a
  dynamic `await import("@parziva-1/zod-mongoose")`. The `exports` field now
  lists the `types` condition first in every conditional block and exposes
  `./package.json` explicitly, per current Node.js/bundler best practice.
  Package correctness is verified in CI via `@arethetypeswrong/cli` and
  `publint`.
- **BREAKING: now requires `zod ^4.0.0`, drops Zod v3 support.** Zod v3 is no
  longer supported at all - this is an intentional major-version rewrite of
  the internal schema introspection to match Zod v4's runtime shape
  (`schema._zod.def`, discriminated on `def.type`), following the same
  v3→v4 migration path taken by `fastify-type-provider-zod`.
- `mongoose` peer dependency range widened to `^8.20.2 || ^9.0.0`.
- The public API (`zodSchema`, `zodSchemaRaw`, `extendZod`, `zId`, `zUUID`,
  `.unique()`, `.sparse()`, `.ref()`, `.refPath()`) is unchanged - this
  should be a drop-in replacement for consumers migrating from the 4.x line
  once their own Zod schemas are upgraded to v4.
- Internally, `.unique()`/`.sparse()` metadata is now stored via Zod v4's
  `.meta()` registry instead of an ad-hoc instance property, since Zod v4
  clones schema instances on most builder calls (`.refine()`, `.min()`, ...)
  and a plain property would not survive that clone.
- `z.enum()` and `z.nativeEnum()` are now handled identically: Zod v4
  represents both as `ZodEnum` and there is no longer a runtime-observable
  difference between them.

### Tooling
- Build tool migrated from `tsup` to `tsdown` (Rolldown-based).
- `tsconfig.json` tightened: `moduleResolution: "bundler"`,
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `isolatedModules`,
  `skipLibCheck`.
- Added `@arethetypeswrong/cli` and `publint` as package-correctness gates
  (`npm run check:types`, `npm run check:pack`).
- Added GitHub Actions CI (lint, typecheck, test, build, attw, publint) and
  a release workflow that publishes to npm with provenance via OIDC trusted
  publishing (no `NPM_TOKEN` secret).
- Added [Changesets](https://github.com/changesets/changesets) for release
  automation.
- Added a proper `LICENSE` file (MIT), test coverage for previously
  under-tested behavior (factory-function defaults, nullable/optional
  combinations, and the refine-before-and-after-transform limitation).

## 4.2.2 - 2025-12-28

## 4.2.1 - 2025-12-11

## 4.2.0 - 2025-08-31

## 4.1.0 - 2025-05-30

## 4.0.0 - 2025-05-23

## 3.2.0 - 2025-01-12

## 3.1.0 - 2025-01-06

## 3.0.0 - 2024-10-19

## 2.3.3 - 2024-09-21

## 2.3.2 - 2024-09-20

## 2.3.1 - 2024-09-15

## 2.3.0 - 2024-09-15

## 2.2.0 - 2024-09-15

## 2.1.0 - 2024-09-07

## 2.0.1 - 2024-08-30
### Added
- Changelog
