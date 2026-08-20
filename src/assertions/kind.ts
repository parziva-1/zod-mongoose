import type { ZodType } from "zod";
import type { IAsserts } from "./types";

/**
 * Kind assertions (Zod v4)
 * @internal
 *
 * Zod v4 exposes a stable, bundler-safe runtime discriminator for every
 * schema via `field._zod.def.type` (e.g. `"string"`, `"object"`, `"pipe"`, ...).
 * This replaces the three-strategy (constructor name / instanceof / manual
 * prototype tagging) approach that was needed under Zod v3, where none of
 * those signals were reliably safe across bundlers on their own.
 */
export const zmAssert: IAsserts = {
  string(f: ZodType): f is any {
    return f._zod.def.type === "string";
  },

  number(f: ZodType): f is any {
    return f._zod.def.type === "number";
  },

  object(f: ZodType): f is any {
    return f._zod.def.type === "object";
  },

  array(f: ZodType): f is any {
    return f._zod.def.type === "array";
  },

  boolean(f: ZodType): f is any {
    return f._zod.def.type === "boolean";
  },

  enumerable(f: ZodType): f is any {
    return f._zod.def.type === "enum";
  },

  date(f: ZodType): f is any {
    return f._zod.def.type === "date";
  },

  def(f: ZodType): f is any {
    return f._zod.def.type === "default";
  },

  optional(f: ZodType): f is any {
    return f._zod.def.type === "optional";
  },

  nullable(f: ZodType): f is any {
    return f._zod.def.type === "nullable";
  },

  union(f: ZodType): f is any {
    return f._zod.def.type === "union";
  },

  any(f: ZodType): f is any {
    // `z.any()` and `z.unknown()` carry no meaningful runtime constraints of
    // their own and map to the exact same Mongoose representation
    // (`SchemaTypes.Mixed`), so they're treated as one case here.
    const type = f._zod.def.type;
    return type === "any" || type === "unknown";
  },

  mapOrRecord(f: ZodType): f is any {
    return f._zod.def.type === "map" || f._zod.def.type === "record";
  },

  pipe(f: ZodType): f is any {
    return f._zod.def.type === "pipe";
  },

  tuple(f: ZodType): f is any {
    return f._zod.def.type === "tuple";
  },

  literal(f: ZodType): f is any {
    return f._zod.def.type === "literal";
  },
};
