import { Schema, type SchemaOptions, SchemaTypes } from "mongoose";
import type { ZodNumber, ZodObject, ZodRawShape, ZodString, ZodType, z } from "zod";

import zmAssert from "./assertions/assertions.js";
import type { zm } from "./mongoose.types.js";

export * from "./extension.js";

/**
 * Maximum number of times `parseField` will follow a given `z.lazy()`
 * getter into itself before bottoming out at `SchemaTypes.Mixed`. Guards
 * against unbounded recursion when parsing a genuinely self-referencing
 * schema (e.g. a comment type whose `replies` field is `z.array(z.lazy(() =>
 * CommentSchema))`) - Mongoose has no native equivalent of an infinitely
 * recursive embedded subdocument, so the structure has to be unrolled to a
 * finite depth. Keyed per-getter (not globally) via `lazyDepth` below, so
 * unrelated lazy schemas in the same document don't share a budget.
 */
const LAZY_DEPTH_LIMIT = 5;
const lazyDepth = new WeakMap<() => ZodType, number>();

/**
 * Converts a Zod schema to a Mongoose schema
 * @param schema zod schema to parse
 * @returns mongoose schema
 *
 * @example
 * import { extendZod, zodSchema } from '@zodyac/zod-mongoose';
 * import { model } from 'mongoose';
 * import { z } from 'zod';
 *
 * extendZod(z);
 *
 * const zUser = z.object({
 *   name: z.string().min(3).max(255),
 *   age: z.number().min(18).max(100),
 *   active: z.boolean().default(false),
 *   access: z.enum(['admin', 'user']).default('user'),
 *   companyId: zId('Company'),
 *   address: z.object({
 *     street: z.string(),
 *     city: z.string(),
 *     state: z.enum(['CA', 'NY', 'TX']),
 *   }),
 *   tags: z.array(z.string()),
 *   createdAt: z.date(),
 *   updatedAt: z.date(),
 * });
 *
 * const schema = zodSchema(zDoc);
 * const userModel = model('User', schema);
 */
export function zodSchema<T extends ZodRawShape>(
  schema: ZodObject<T>,
  options?: SchemaOptions<any>, // TODO: Fix any
): Schema<z.infer<typeof schema>> {
  const definition = parseObject(schema, true);
  return new Schema<z.infer<typeof schema>>(definition, options);
}

/**
 * Converts a Zod schema to a raw Mongoose schema object
 * @param schema zod schema to parse
 * @returns mongoose schema
 *
 * @example
 * import { extendZod, zodSchemaRaw } from '@zodyac/zod-mongoose';
 * import { model, Schema } from 'mongoose';
 * import { z } from 'zod';
 *
 * extendZod(z);
 *
 * const zUser = z.object({
 *   name: z.string().min(3).max(255),
 *   age: z.number().min(18).max(100),
 *   active: z.boolean().default(false),
 *   access: z.enum(['admin', 'user']).default('user'),
 *   companyId: zId('Company'),
 *   address: z.object({
 *    street: z.string(),
 *    city: z.string(),
 *    state: z.enum(['CA', 'NY', 'TX']),
 *   }),
 *  tags: z.array(z.string()),
 *  createdAt: z.date(),
 *  updatedAt: z.date(),
 * });
 *
 * const rawSchema = zodSchemaRaw(zDoc);
 * const schema = new Schema(rawSchema);
 * const userModel = model('User', schema);
 */
export function zodSchemaRaw<T extends ZodRawShape>(schema: ZodObject<T>): zm._Schema<T> {
  return parseObject(schema, true) as zm._Schema<T>;
}

// Helpers
function parseObject<T extends ZodRawShape>(obj: ZodObject<T>): zm._Schema<T>;
function parseObject<T extends ZodRawShape>(
  obj: ZodObject<T>,
  required: true,
): zm._Schema<T>;
function parseObject<T extends ZodRawShape>(
  obj: ZodObject<T>,
  required: false,
): zm.mSubdocument<T>;
function parseObject<T extends ZodRawShape>(
  obj: ZodObject<T>,
  required: boolean,
): zm._Schema<T> | zm.mSubdocument<T>;
function parseObject<T extends ZodRawShape>(
  obj: ZodObject<T>,
  required = true,
): zm._Schema<T> | zm.mSubdocument<T> {
  const object: any = parseShape(obj.shape as ZodRawShape);

  if (!required) {
    return {
      type: object,
      required: false,
    } as zm.mSubdocument<T>;
  }

  return object;
}

/**
 * Parses a raw Zod shape (a plain `{ key: ZodType }` map, as found on
 * `ZodObject.shape`) into a Mongoose field-definition object. Shared between
 * `parseObject` (which operates on an actual `ZodObject`) and the
 * `z.intersection()` handler, which needs to merge two shapes into one flat
 * object without constructing a synthetic `ZodObject` instance.
 */
function parseShape(shape: ZodRawShape): Record<string, unknown> {
  const object: any = {};
  for (const [key, field] of Object.entries(shape)) {
    if (zmAssert.object(field as ZodType)) {
      object[key] = parseObject(field as ZodObject<any>, true);
    } else {
      const f = parseField(field as ZodType);
      if (!f)
        throw new Error(`Unsupported field type: ${(field as ZodType).constructor}`);

      object[key] = f;
    }
  }
  return object;
}

/**
 * Walks a schema's own `checks` array (Zod v4) and returns the metadata for
 * *every* `.refine()` custom check found on it, in declaration order.
 *
 * Zod v4 no longer wraps refined schemas in a `ZodEffects`-like type: calling
 * `.refine()` simply appends a `"custom"` check to the schema's own
 * `_zod.def.checks` array (or, when chained after `.transform()`, to the
 * resulting `ZodPipe`'s own `checks` array). The check object itself already
 * carries the validator function (`fn`) and a normalized error accessor
 * (`error`), so there is no need to monkey-patch `refine()` to capture this
 * metadata as was necessary under Zod v3.
 *
 * A single Zod type can carry multiple `.refine()` checks (e.g.
 * `z.string().refine(a).refine(b)`), and `parseField` also needs to combine
 * checks found on *different* nodes of a `ZodPipe` (a pre-transform refine on
 * the pipe's `in` side plus a post-transform refine on the pipe itself) - so
 * this returns all matches rather than just the last one, leaving the
 * caller free to merge them with refinements collected elsewhere.
 */
function extractRefinements<T>(field: ZodType): zm.EffectValidator<T>[] {
  const checks = (field as any)._zod?.def?.checks as any[] | undefined;
  if (!checks || checks.length === 0) return [];

  const refinements: zm.EffectValidator<T>[] = [];
  for (const check of checks) {
    const checkDef = check?._zod?.def;
    if (!checkDef || checkDef.check !== "custom") continue;

    let message: string | undefined;
    if (typeof checkDef.error === "function") {
      try {
        message = checkDef.error({});
      } catch {
        message = undefined;
      }
    } else if (typeof checkDef.error === "string") {
      message = checkDef.error;
    }

    refinements.push({
      validator: checkDef.fn,
      message,
    });
  }

  return refinements;
}

function toRefinementArray<T>(
  refinement: zm.EffectValidator<T> | zm.EffectValidator<T>[] | undefined,
): zm.EffectValidator<T>[] {
  if (!refinement) return [];
  return Array.isArray(refinement) ? refinement : [refinement];
}

function parseField<T>(
  field: ZodType,
  required = true,
  def?: zm.mDefault<T>,
  refinement?: zm.EffectValidator<T> | zm.EffectValidator<T>[],
): zm.mField | null {
  if (zmAssert.objectId(field)) {
    const ref = (<any>field).__zm_ref;
    const refPath = (<any>field).__zm_refPath;
    const unique = (<any>field).__zm_unique;
    const sparse = (<any>field).__zm_sparse;
    return parseObjectId(required, ref, unique, refPath, sparse);
  }

  if (zmAssert.uuid(field)) {
    const ref = (<any>field).__zm_ref;
    const refPath = (<any>field).__zm_refPath;
    const unique = (<any>field).__zm_unique;
    const sparse = (<any>field).__zm_unique;
    return parseUUID(required, ref, unique, refPath, sparse);
  }

  if (zmAssert.object(field)) {
    return parseObject(field as ZodObject<any>, required);
  }

  // Combine any `.refine()` checks found directly on this node with any
  // passed down from an outer node (e.g. a post-transform refine on the
  // enclosing `ZodPipe`), so refinements on *both* sides of a `.transform()`
  // survive instead of the outer one silently overwriting the inner one.
  const combinedRefinements = [
    ...extractRefinements<T>(field),
    ...toRefinementArray(refinement),
  ];
  const ownRefinement: zm.EffectValidator<T> | zm.EffectValidator<T>[] | undefined =
    combinedRefinements.length === 0
      ? undefined
      : combinedRefinements.length === 1
        ? combinedRefinements[0]
        : combinedRefinements;

  if (zmAssert.number(field)) {
    const numberField = field as ZodNumber;
    const meta = numberField.meta() as any;
    const isUnique = meta?.__zm_unique ?? false;
    const isSparse = meta?.__zm_sparse ?? false;
    return parseNumber(
      numberField,
      required,
      def as zm.mDefault<number>,
      isUnique,
      ownRefinement as zm.mValidate<number> | undefined,
      isSparse,
    );
  }

  if (zmAssert.string(field)) {
    const stringField = field as ZodString;
    const meta = stringField.meta() as any;
    const isUnique = meta?.__zm_unique ?? false;
    const isSparse = meta?.__zm_sparse ?? false;
    return parseString(
      stringField,
      required,
      def as zm.mDefault<string>,
      isUnique,
      ownRefinement as zm.mValidate<string> | undefined,
      isSparse,
    );
  }

  if (zmAssert.enumerable(field)) {
    // Zod v4 represents both `z.enum()` and `z.nativeEnum()` as `ZodEnum`,
    // exposing the same values via the `.enum` map in both cases.
    return parseEnum(
      Object.values((<any>field).enum),
      required,
      def as zm.mDefault<string>,
    );
  }

  if (zmAssert.boolean(field)) {
    return parseBoolean(required, def as zm.mDefault<boolean>);
  }

  if (zmAssert.date(field)) {
    const dateField = field as any;
    const meta = dateField.meta?.() as any;
    const isUnique = meta?.__zm_unique ?? false;
    const isSparse = meta?.__zm_sparse ?? false;
    return parseDate(
      required,
      def as zm.mDefault<Date>,
      ownRefinement as zm.mValidate<Date> | undefined,
      isUnique,
      isSparse,
    );
  }

  if (zmAssert.array(field)) {
    const arrayField = field as any;
    return parseArray(
      arrayField.element,
      required,
      def as zm.mDefault<T extends Array<infer K> ? K[] : never>,
    );
  }

  if (zmAssert.def(field)) {
    const defField = field as any;
    const innerType = defField._zod.def.innerType as ZodType;
    // Zod v4 stores `defaultValue` behind a getter, re-evaluating any factory
    // function passed to `.default()` on every access - wrap it the same way
    // so a fresh value is produced per document, matching Zod v3 behavior
    // (where `_def.defaultValue` was already a `() => T` callback).
    return parseField(innerType, required, () => defField._zod.def.defaultValue);
  }

  if (zmAssert.optional(field)) {
    const innerType = (field as any)._zod.def.innerType as ZodType;
    return parseField(innerType, false, undefined);
  }

  if (zmAssert.nullable(field)) {
    const innerType = (field as any)._zod.def.innerType as ZodType;
    return parseField(
      innerType,
      false,
      (typeof def !== "undefined" ? def : () => null) as zm.mDefault<null>,
    );
  }

  // Must run before the generic `union` check below - Zod v4 represents
  // `z.discriminatedUnion()` as a `ZodUnion` with an extra `discriminator`
  // key, so it would otherwise match the plain-union branch and silently
  // collapse to its first variant.
  if (zmAssert.discriminatedUnion(field)) {
    return parseDiscriminatedUnion(field, required, def);
  }

  if (zmAssert.union(field)) {
    const options = (field as any)._zod.def.options as ZodType[];
    const firstOption = options[0];
    if (!firstOption) throw new Error("Union type must have at least one option");
    return parseField(firstOption);
  }

  if (zmAssert.any(field)) {
    return parseMixed(required, def);
  }

  if (zmAssert.tuple(field)) {
    return parseTuple(field, required, def);
  }

  if (zmAssert.literal(field)) {
    const values = (field as any)._zod.def.values as unknown[];
    return parseLiteral(values, required, def);
  }

  if (zmAssert.intersection(field)) {
    const { left, right } = (field as any)._zod.def as { left: ZodType; right: ZodType };
    if (!zmAssert.object(left) || !zmAssert.object(right)) {
      throw new Error(
        "Unsupported intersection: zod-mongoose can only merge two object-shape schemas (z.object(...).and(z.object(...))) into a flat Mongoose sub-schema",
      );
    }
    const mergedShape = {
      ...(left as ZodObject<any>).shape,
      ...(right as ZodObject<any>).shape,
    };
    const merged = parseShape(mergedShape as ZodRawShape);
    if (!required) {
      return { type: merged, required: false } as unknown as zm.mField;
    }
    return merged as unknown as zm.mField;
  }

  if (zmAssert.lazy(field)) {
    const getter = (field as any)._zod.def.getter as () => ZodType;
    const depth = lazyDepth.get(getter) ?? 0;
    if (depth >= LAZY_DEPTH_LIMIT) {
      // Bottom out recursive/self-referencing schemas at a fixed depth.
      // Mongoose has no native concept of an infinitely recursive embedded
      // subdocument (unlike Zod, which can describe one lazily); beyond this
      // depth we fall back to Mixed rather than recursing forever. This is a
      // pragmatic compromise, not a full solution - documents nested deeper
      // than the limit still round-trip through Mongo, they just lose
      // structural validation past that point.
      return parseMixed(required, def);
    }
    lazyDepth.set(getter, depth + 1);
    try {
      const inner = getter();
      return parseField(inner, required, def, refinement);
    } finally {
      lazyDepth.set(getter, depth);
    }
  }

  if (zmAssert.catch(field)) {
    const catchField = field as any;
    const innerType = catchField._zod.def.innerType as ZodType;
    const catchValueFn = catchField._zod.def.catchValue as (ctx: {
      value: unknown;
      issues: unknown[];
      error?: unknown;
    }) => unknown;

    const inner = parseField(innerType, required, def, refinement);
    if (!inner) return inner;

    // Emulate Zod's `.catch()` semantics (fall back to a computed/static
    // value when parsing the input fails) via Mongoose's `set` transform.
    // Mongoose's own `default` only applies when a path is `undefined`, not
    // when a *present* value fails validation - which is the actual
    // `.catch()` contract, so `default` alone can't represent it.
    const previousSet = (inner as any).set as ((v: unknown) => unknown) | undefined;
    (inner as any).set = (v: unknown) => {
      const result = innerType.safeParse(v);
      const resolved = result.success
        ? result.data
        : catchValueFn({ value: v, issues: result.error.issues, error: result.error });
      return previousSet ? previousSet(resolved) : resolved;
    };
    return inner;
  }

  if (zmAssert.mapOrRecord(field)) {
    const mapField = field as any;
    return parseMap(
      mapField.valueType,
      required,
      def as zm.mDefault<
        Map<
          zm.UnwrapZodType<typeof mapField.keyType>,
          zm.UnwrapZodType<typeof mapField.valueType>
        >
      >,
    );
  }

  if (zmAssert.pipe(field)) {
    // Zod v4 represents both `.transform()` and `z.preprocess()` as a
    // `ZodPipe` under the hood:
    //   - `.transform()`  -> pipe(originalSchema, ZodTransform)
    //   - `z.preprocess()` -> pipe(ZodTransform, targetSchema)
    // In both cases, the side that is NOT a `ZodTransform` carries the real
    // structural type (string/number/date/...) we need to introspect.
    const pipeDef = (field as any)._zod.def as { in: ZodType; out: ZodType };
    const inIsTransform = (pipeDef.in as any)._zod.def.type === "transform";
    const target = inIsTransform ? pipeDef.out : pipeDef.in;

    return parseField(target, required, def, ownRefinement);
  }

  return null;
}

function parseNumber(
  field: ZodNumber,
  required = true,
  def?: zm.mDefault<number>,
  unique = false,
  validate?: zm.mValidate<number>,
  sparse = false,
): zm.mNumber {
  const output: zm.mNumber = {
    type: Number,
    default: def,
    // Zod v4's `minValue`/`maxValue` getters default to `-Infinity`/`Infinity`
    // (not `null`, as in Zod v3) when no `.min()`/`.max()` check is present.
    min: Number.isFinite(field.minValue) ? (field.minValue ?? undefined) : undefined,
    max: Number.isFinite(field.maxValue) ? (field.maxValue ?? undefined) : undefined,
    required,
    unique,
    sparse,
  };

  if (validate) output.validate = validate;
  return output;
}

function parseString(
  field: ZodString,
  required = true,
  def?: zm.mDefault<string>,
  unique = false,
  validate?: zm.mValidate<string>,
  sparse = false,
): zm.mString {
  const output: zm.mString = {
    type: String,
    default: def,
    required,
    minLength: field.minLength ?? undefined,
    maxLength: field.maxLength ?? undefined,
    unique,
    sparse,
  };

  if (validate) output.validate = validate;
  return output;
}

function parseEnum(
  values: string[],
  required = true,
  def?: zm.mDefault<string>,
): zm.mString {
  return {
    type: String,
    unique: false,
    sparse: false,
    default: def,
    enum: values,
    required,
  };
}

function parseBoolean(required = true, def?: zm.mDefault<boolean>): zm.mBoolean {
  return {
    type: Boolean,
    default: def,
    required,
  };
}

function parseDate(
  required = true,
  def?: zm.mDefault<Date>,
  validate?: zm.mValidate<Date>,
  unique = false,
  sparse = false,
): zm.mDate {
  const output: zm.mDate = {
    type: Date,
    default: def,
    required,
    unique,
    sparse,
  };

  if (validate) output.validate = validate;
  return output;
}

function parseObjectId(
  required = true,
  ref?: string,
  unique = false,
  refPath?: string,
  sparse = false,
): zm.mObjectId {
  const output: zm.mObjectId = {
    type: SchemaTypes.ObjectId,
    required,
    unique,
    sparse,
  };

  if (ref) output.ref = ref;
  if (refPath) output.refPath = refPath;
  return output;
}

function parseArray<T>(
  element: ZodType,
  required = true,
  def?: zm.mDefault<T[]>,
): zm.mArray<T> {
  const innerType = parseField(element);
  if (!innerType) throw new Error("Unsupported array type");
  return {
    type: [innerType as zm._Field<T>],
    default: def,
    required,
  };
}

function parseMap<T, K>(
  valueType: ZodType,
  required = true,
  def?: zm.mDefault<Map<NoInfer<T>, K>>,
): zm.mMap<T, K> {
  const pointer = parseField(valueType);
  if (!pointer) throw new Error("Unsupported map value type");

  return {
    type: Map,
    of: pointer as zm._Field<K>,
    default: def,
    required,
  };
}

function parseUUID(
  required = true,
  ref?: string,
  unique = false,
  refPath?: string,
  sparse = false,
): zm.mUUID {
  const output: zm.mUUID = {
    type: SchemaTypes.UUID,
    required,
    unique,
    sparse,
  };
  if (ref) output.ref = ref;
  if (refPath) output.refPath = refPath;
  return output;
}

function parseMixed(required = true, def?: unknown): zm.mMixed<unknown> {
  return {
    type: SchemaTypes.Mixed,
    default: def as unknown as any,
    required,
  };
}

/**
 * `z.tuple()` has no native Mongoose equivalent (Mongoose arrays are
 * homogeneous and unbounded). It's represented as a Mongoose array of
 * `Mixed` - so it still round-trips through Mongo as a JSON array - with a
 * `validate` that enforces the tuple's actual contract (exact arity, or a
 * minimum arity plus a rest type, and the correct type at each position).
 * Rather than re-deriving per-position type checks by hand, the validator
 * reuses the original Zod item schemas' own `.safeParse()`, which is both
 * simpler and guaranteed to match Zod's own validation semantics exactly.
 */
function parseTuple(field: ZodType, required = true, def?: unknown): zm.mArray<unknown> {
  const tupleDef = (field as any)._zod.def as { items: ZodType[]; rest: ZodType | null };
  const items = tupleDef.items;
  const rest = tupleDef.rest;

  const validator = (value: unknown): boolean => {
    if (!Array.isArray(value)) return false;
    if (rest) {
      if (value.length < items.length) return false;
    } else if (value.length !== items.length) {
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const itemSchema = items[i];
      if (!itemSchema || !itemSchema.safeParse(value[i]).success) return false;
    }
    if (rest) {
      for (let i = items.length; i < value.length; i++) {
        if (!rest.safeParse(value[i]).success) return false;
      }
    }
    return true;
  };

  const message = rest
    ? `Expected a tuple of at least ${items.length} element(s) matching the declared types`
    : `Expected a tuple of exactly ${items.length} element(s) matching the declared types`;

  return {
    type: [{ type: SchemaTypes.Mixed, required: false }] as unknown as [
      zm._Field<unknown>,
    ],
    default: def as zm.mDefault<unknown[]>,
    required,
    validate: { validator, message },
  };
}

/**
 * Maps `z.literal()` to the closest native Mongoose representation of its
 * value(s):
 *  - all-string values -> `String` with Mongoose's native `enum` constraint
 *  - all-number / all-boolean values -> that primitive type plus a
 *    `validate` enforcing membership (Mongoose has no native `enum` for
 *    non-string types)
 *  - anything else (mixed types, or types Mongoose has no primitive for,
 *    e.g. `bigint`) -> `Mixed` plus the same membership `validate`
 * `z.literal()` supports multiple values in Zod v4 (`z.literal(["a", "b"])`),
 * which is why this always validates against the full `values` array rather
 * than assuming a single value.
 */
function parseLiteral(values: unknown[], required = true, def?: unknown): zm.mField {
  const types = new Set(values.map((v) => typeof v));
  const message = `Value must be one of: ${values.map((v) => JSON.stringify(v)).join(", ")}`;

  if (types.size === 1 && types.has("string")) {
    return parseEnum(values as string[], required, def as zm.mDefault<string>);
  }

  if (types.size === 1 && types.has("number")) {
    return {
      type: Number,
      required,
      unique: false,
      sparse: false,
      default: def as zm.mDefault<number>,
      validate: { validator: (v: number) => values.includes(v), message },
    };
  }

  if (types.size === 1 && types.has("boolean")) {
    return {
      type: Boolean,
      required,
      default: def as zm.mDefault<boolean>,
      validate: { validator: (v: boolean) => values.includes(v), message },
    };
  }

  return {
    type: SchemaTypes.Mixed,
    required,
    default: def as unknown as any,
    validate: { validator: (v: unknown) => values.includes(v), message },
  };
}

/**
 * `z.discriminatedUnion()` models real polymorphic documents (variants that
 * share a discriminant key but otherwise diverge in shape), which Mongoose
 * has no first-class support for on a plain nested field (Mongoose's own
 * "discriminator" feature only applies to top-level models / array
 * subdocuments, not to an arbitrary object-valued field). Rather than pick
 * one variant's shape and lose the others (as the plain `union` handling
 * does), this maps the field to `Mixed` and validates it against the
 * *entire* original discriminated-union schema via `.safeParse()` - which
 * already implements exactly the "dispatch on the discriminant, then
 * validate against the matching variant" behavior this needs, so there is no
 * reason to reimplement it.
 */
function parseDiscriminatedUnion(
  field: ZodType,
  required = true,
  def?: unknown,
): zm.mMixed<unknown> {
  return {
    type: SchemaTypes.Mixed,
    required,
    default: def as unknown as any,
    validate: {
      validator: (v: unknown) => field.safeParse(v).success,
      message: "Value does not match any variant of the discriminated union",
    },
  };
}

export default zodSchema;
