import type {
  ZodAny,
  ZodArray,
  ZodBoolean,
  ZodDate,
  ZodDefault,
  ZodDiscriminatedUnion,
  ZodEnum,
  ZodIntersection,
  ZodLazy,
  ZodLiteral,
  ZodMap,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodPipe,
  ZodRecord,
  ZodString,
  ZodTuple,
  ZodType,
  ZodUnion,
  ZodUnknown,
} from "zod";

export interface IAsserts {
  string(f: ZodType): f is ZodString;
  number(f: ZodType): f is ZodNumber;
  object(f: ZodType): f is ZodObject;
  array(f: ZodType): f is ZodArray;
  boolean(f: ZodType): f is ZodBoolean;
  /**
   * Matches both `z.enum()` and `z.nativeEnum()`.
   * Zod v4 represents both as `ZodEnum` (`_zod.def.type === "enum"`),
   * so there is no runtime way to distinguish them anymore.
   */
  enumerable(f: ZodType): f is ZodEnum;
  date(f: ZodType): f is ZodDate;
  def(f: ZodType): f is ZodDefault;
  optional(f: ZodType): f is ZodOptional;
  nullable(f: ZodType): f is ZodNullable;
  union(f: ZodType): f is ZodUnion;
  /** Matches `z.any()` and `z.unknown()` - both map to `SchemaTypes.Mixed`. */
  any(f: ZodType): f is ZodAny | ZodUnknown;
  mapOrRecord(f: ZodType): f is ZodMap | ZodRecord;
  /**
   * Matches `ZodPipe` schemas produced by `.transform()` / `z.preprocess()`.
   * Zod v4 no longer has a `ZodEffects` wrapper type.
   */
  pipe(f: ZodType): f is ZodPipe;
  tuple(f: ZodType): f is ZodTuple;
  literal(f: ZodType): f is ZodLiteral;
  /**
   * Matches `z.discriminatedUnion()`. Must be checked before the generic
   * `union` assertion - Zod v4 represents both as `ZodUnion` under the hood.
   */
  discriminatedUnion(f: ZodType): f is ZodDiscriminatedUnion;
  intersection(f: ZodType): f is ZodIntersection;
  lazy(f: ZodType): f is ZodLazy;
}
