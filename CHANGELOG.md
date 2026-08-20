# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 5.0.0 - 2026-08-20
### Breaking
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
