# @spybee/zod-mongoose

![CI](https://github.com/parziva-1/zod-mongoose/actions/workflows/ci.yml/badge.svg)
![NPM Version](https://img.shields.io/npm/v/%40spybee%2Fzod-mongoose)
![License](https://img.shields.io/npm/l/%40spybee%2Fzod-mongoose)
![Test coverage](./badges/coverage.svg)

Convert [Zod](https://www.npmjs.com/package/zod) object schemas into
[Mongoose](https://www.npmjs.com/package/mongoose) schemas, keeping a single
source of truth for both runtime validation and your database layer.

## Why this fork exists

This is a fork of the excellent
[`@zodyac/zod-mongoose`](https://www.npmjs.com/package/@zodyac/zod-mongoose)
(upstream: [git-zodyac/mongoose](https://github.com/git-zodyac/mongoose)),
created to add **Zod v4 support**. As of this writing, upstream is still on
Zod v3 internals and has not published a v4-compatible release. This fork
ports the schema introspection layer to Zod v4's runtime shape
(`schema._zod.def`) while keeping the public API unchanged, so it's a drop-in
replacement once your own Zod schemas are upgraded to v4.

All credit for the original design and implementation goes to the upstream
`zodyac` project and its contributors (see [LICENSE](./LICENSE)).

## Installation

```bash
npm install @spybee/zod-mongoose
pnpm add @spybee/zod-mongoose
yarn add @spybee/zod-mongoose
bun add @spybee/zod-mongoose
```

Peer dependencies: `zod@^4.0.0` and `mongoose@^8.20.2 || ^9.0.0`.

## Migrating from `@zodyac/zod-mongoose`

- **Package name**: import from `@spybee/zod-mongoose` instead of
  `@zodyac/zod-mongoose`.
- **Zod version**: you must be on `zod@^4.0.0`. Zod v3 is not supported at
  all - stay on the upstream package (or this fork's `4.x` line, if you need
  an intermediate step) until your schemas are migrated.
- **Module format**: this package is **ESM-only** starting with v5 (no CJS
  build). If you `require()` it from CommonJS, use a dynamic
  `await import("@spybee/zod-mongoose")` instead.
- **Public API is unchanged**: `zodSchema`, `zodSchemaRaw`, `extendZod`,
  `zId`, `zUUID`, `.unique()`, `.sparse()`, `.ref()`, `.refPath()` all keep
  their existing signatures.

See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes.

## Quick start

First, extend Zod with `extendZod`, then create your Zod schema:

```typescript
import { z } from "zod";
import { extendZod, zId, zUUID } from "@spybee/zod-mongoose";

extendZod(z);

const zUser = z.object({
  name: z.string().min(3).max(255),
  age: z.number().min(18).max(100),
  active: z.boolean().default(false),
  access: z.enum(["admin", "user"]).default("user"),
  companyId: zId("Company"),
  wearable: zUUID(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.enum(["CA", "NY", "TX"]),
  }),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

Then convert it to a Mongoose schema and connect a model:

```typescript
import { zodSchema } from "@spybee/zod-mongoose";
import { model } from "mongoose";

const schema = zodSchema(zUser);
const userModel = model("User", schema);
```

That's it - now use your Mongoose model as usual:

```typescript
userModel.find({ name: "John" });
```

> [!NOTE]
> `extendZod` should be called once for the whole application.

## Features

See [SUPPORTED.md](./SUPPORTED.md) for the full, authoritative type/feature
support matrix. Summary:

- Basic types (string, number, boolean, date)
- Nested objects, subdocuments, and arrays
- Enums and native (TypeScript) enums
- Default values (static and factory-function forms)
- Maps and records (records become `Map`)
- ObjectId and UUID, with `ref` / `refPath` support
- `ZodAny` as `SchemaTypes.Mixed`
- Validation via `.refine()` for String, Number, Date
- `.unique()` / `.sparse()` for String, Number, Date, ObjectId, and UUID
- `.transform()` / `z.preprocess()`

Known limitations: unions pick the first inner type (Mongoose has no native
union type), and a refinement applied both before *and* after a
`.transform()` currently only keeps the pre-transform refinement - see
[SUPPORTED.md](./SUPPORTED.md) for details.

## Checking schemas

To make sure nothing is missing, inspect `Schema.obj`:

```typescript
// schema is a mongoose schema
console.log(schema.obj);
```

## Raw object

If you want the raw object produced from a Zod schema so you can modify it
before constructing the `Schema`, use `zodSchemaRaw`:

```typescript
import { extendZod, zodSchemaRaw } from "@spybee/zod-mongoose";
import { model, Schema } from "mongoose";
import { z } from "zod";

extendZod(z);

const schema = zodSchemaRaw(zUser);
schema.age.index = true;

const userModel = model(
  "User",
  new Schema(schema, {
    timestamps: true,
  }),
);
```

## ObjectID and UUID

Use `zId(ref?: string)` and `zUUID(ref?: string)` to describe ObjectID and
UUID fields, and to reference another collection:

```typescript
import { extendZod, zId, zUUID } from "@spybee/zod-mongoose";
import { z } from "zod";

extendZod(z);

const zUser = z.object({
  // Just the ID
  someId: zId(),
  wearable: zUUID(),

  // With reference
  companyId: zId("Company"), // equivalent to zId().ref("Company")
  facilityId: zId().ref("Facility"),
  device: zUUID("Device"), // equivalent to zUUID().ref("Device")
  badgeId: zUUID().ref("Badge"),

  // `refPath` support
  storeId: zId().refPath("store"),
  store: z.string(),
  proxyId: zUUID().refPath("proxy"),
  proxy: z.string(),
});
```

## Validation

Use Zod refinement to validate your Mongoose models:

```typescript
import { z } from "zod";
import { extendZod, zodSchema } from "@spybee/zod-mongoose";

extendZod(z);

const zUser = z.object({
  phone: z
    .string()
    .refine((v) => /^\d{3}-\d{3}-\d{4}$/.test(v), "Invalid phone number"),
});
```

## Unique fields

To make a String, Number, Date, ObjectId, or UUID field unique, call
`.unique()`:

```typescript
const zUser = z.object({
  phone: z.string().unique(),
});
```

## Sparse fields

To make a String, Number, Date, ObjectId, or UUID field sparse, call
`.sparse()`:

```typescript
const zUser = z.object({
  email: z.string().sparse(),
  // combine with unique:
  // email: z.string().unique().sparse(),
});
```

## Warnings

### ZodUnion types

Unions are not supported by Mongoose. A union field is converted to its
*first* inner type:

```typescript
const zUser = z.object({
  access: z.union([z.string(), z.number()]),
});

// Becomes:
// { access: { type: String } }
```

### ZodAny

`ZodAny` is converted to `SchemaTypes.Mixed`. Prefer a more specific type
when possible.

### ZodRecord

`ZodRecord` is converted to `Map`. Prefer `z.map()` directly when possible.

## Contributing

Feel free to open issues and pull requests!

- Fork the repository
- Install the [Biome](https://biomejs.dev/) VS Code extension
- Install dependencies: `npm install`
- Make your changes
- Run the full check suite: `npm run check` (lint, typecheck, test, build,
  attw, publint)
- Commit and push your changes
- Open a pull request

## License

MIT - see [LICENSE](./LICENSE). Includes the original upstream copyright
notice plus this fork's additions.
