import { Schema, type SchemaOptions, SchemaTypes } from "mongoose";
import type { ZodNumber, ZodObject, ZodRawShape, ZodString, ZodType, z } from "zod";

import zmAssert from "./assertions/assertions.js";
import type { zm } from "./mongoose.types.js";

export * from "./extension.js";

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
  const object: any = {};
  for (const [key, field] of Object.entries(obj.shape)) {
    if (zmAssert.object(field as ZodType)) {
      object[key] = parseObject(field as ZodObject<any>, true);
    } else {
      const f = parseField(field as ZodType);
      if (!f)
        throw new Error(`Unsupported field type: ${(field as ZodType).constructor}`);

      object[key] = f;
    }
  }

  if (!required) {
    return {
      type: object,
      required: false,
    } as zm.mSubdocument<T>;
  }

  return object;
}

/**
 * Walks a schema's own `checks` array (Zod v4) and returns the metadata for
 * the last `.refine()` custom check found, if any.
 *
 * Zod v4 no longer wraps refined schemas in a `ZodEffects`-like type: calling
 * `.refine()` simply appends a `"custom"` check to the schema's own
 * `_zod.def.checks` array (or, when chained after `.transform()`, to the
 * resulting `ZodPipe`'s own `checks` array). The check object itself already
 * carries the validator function (`fn`) and a normalized error accessor
 * (`error`), so there is no need to monkey-patch `refine()` to capture this
 * metadata as was necessary under Zod v3.
 */
function extractRefinement<T>(field: ZodType): zm.EffectValidator<T> | undefined {
  const checks = (field as any)._zod?.def?.checks as any[] | undefined;
  if (!checks || checks.length === 0) return undefined;

  for (let i = checks.length - 1; i >= 0; i--) {
    const check = checks[i];
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

    return {
      validator: checkDef.fn,
      message,
    };
  }

  return undefined;
}

function parseField<T>(
  field: ZodType,
  required = true,
  def?: zm.mDefault<T>,
  refinement?: zm.EffectValidator<T>,
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

  const ownRefinement = extractRefinement<T>(field) ?? refinement;

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
      ownRefinement as zm.EffectValidator<number>,
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
      ownRefinement as zm.EffectValidator<string>,
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
      ownRefinement as zm.EffectValidator<Date>,
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

  if (zmAssert.union(field)) {
    const options = (field as any)._zod.def.options as ZodType[];
    const firstOption = options[0];
    if (!firstOption) throw new Error("Union type must have at least one option");
    return parseField(firstOption);
  }

  if (zmAssert.any(field)) {
    return parseMixed(required, def);
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

    return parseField(target, required, def, ownRefinement as zm.EffectValidator<T>);
  }

  return null;
}

function parseNumber(
  field: ZodNumber,
  required = true,
  def?: zm.mDefault<number>,
  unique = false,
  validate?: zm.EffectValidator<number>,
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
  validate?: zm.EffectValidator<string>,
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
  validate?: zm.EffectValidator<Date>,
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

export default zodSchema;
