# List of supported types and features

This is the list of all enabled features and types in `zod-mongoose`. If there
is a feature or type you would like to see supported, please open an issue on
GitHub.

Please note that this list is not exhaustive and may change in the future. It
contains the features that are encountered the most, are uncontroversial and are
being tested.

## Full support

These types and features are fully supported and tested:

- ✅ Number (ZodNumber)
- ✅ String (ZodString)
- ✅ Boolean (ZodBoolean)
- ✅ Date (ZodDate)
- ✅ Null (ZodNull)
- ✅ Mixed (ZodAny)
- ✅ ObjectId (custom, `zId()`)
- ✅ UUID (custom, `zUUID()`)
- ✅ Nested objects and schemas (ZodObject)
- ✅ Arrays (ZodArray)
- ✅ Enums, including native (TypeScript) enums (ZodEnum)
- ✅ Default values (ZodDefault), both a static value and a factory function
  (`() => value`), re-evaluated on every access
- ✅ Maps (ZodMap) and Records (ZodRecord, converted to `Map`)
- ✅ ObjectId references (custom, `zId(ref)`)
- ✅ Optional fields (ZodOptional)
- ✅ Nullable fields (ZodNullable), including combined with `.optional()`
- ✅ `.transform()` and `z.preprocess()` (ZodPipe)
- ✅ Validation using refinement (`z.refine()`):
  - `String`,
  - `Number`,
  - `Date`
  - A refinement applied before OR after a single `.transform()` is
    preserved. See the "Danger zone" note below for the one combined case
    that is not.
- ✅ Unique:
  - `String`,
  - `Number`,
  - `Date`,
  - `ObjectId`,
  - `UUID`
- ✅ Sparse:
  - `String`,
  - `Number`,
  - `Date`,
  - `ObjectId`,
  - `UUID`

## Danger zone

- ⚠️ Record (Being converted to `Map`)
- ⚠️ Unions (Not supported by mongoose, **will pick first inner type**)
- ⚠️ **Refine-before-and-after-transform**: if a field is refined both
  *before and after* a single `.transform()` call (e.g.
  `z.string().refine(a).transform(fn).refine(b)`), only the pre-transform
  refinement (`a`) is currently kept - the post-transform refinement (`b`)
  is silently dropped. This is a known, tested limitation (see
  `src/index.spec.ts`, "KNOWN GAP" test) rather than a supported feature; do
  not rely on the post-transform refinement running.

## Not supported by Mongoose

- ❌ ZodTuple

## Not supported by Zod

- ❌ Indexes

## Not supported yet

- ❌ Discriminated unions (See
  [#16](https://github.com/git-zodyac/mongoose/issues/16))
- ⏳ Regex validation
- ⏳ instanceOf
