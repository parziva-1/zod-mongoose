import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";

declare module "zod" {
  interface ZodString {
    unique: (arg?: boolean) => ZodString;
    sparse: (arg?: boolean) => ZodString;
  }

  interface ZodNumber {
    unique: (arg?: boolean) => ZodNumber;
    sparse: (arg?: boolean) => ZodNumber;
  }

  interface ZodDate {
    unique: (arg?: boolean) => ZodDate;
    sparse: (arg?: boolean) => ZodDate;
  }

  interface ZodType {
    __zm_type?: string;
    __zm_ref?: string;
    __zm_refPath?: string;
  }
}

let zod_extended = false;
/**
 * Extends the Zod library with additional functionality.
 *
 * This function modifies the Zod library to add custom mongoose-specific
 * metadata methods. It ensures that the extension is only applied once.
 *
 * @param z_0 - The Zod library to extend.
 *
 * @remarks
 * - Adds a `unique` method to `ZodString`, `ZodNumber`, and `ZodDate` to mark them as unique.
 * - Adds a `sparse` method to `ZodString`, `ZodNumber`, and `ZodDate` to mark them as sparse.
 *
 * As of Zod v4, refinement metadata (validator + message) no longer needs to
 * be captured via a `refine()` override: Zod's own internal `checks` array
 * already exposes the validator function and error message directly, so
 * `zodSchema()` reads that straight off the schema instead.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { extendZod } from "./extension";
 *
 * extendZod(z);
 *
 * const schema = z.object({
 *   name: z.string().unique();
 * });
 * ```
 */
export function extendZod(z_0: typeof z) {
  // Prevent zod from being extended multiple times
  if (zod_extended) return;
  zod_extended = true;

  // Unique / sparse support
  //
  // Metadata is stored via Zod v4's built-in `.meta()` registry rather than
  // as an ad-hoc instance property. `.meta()` merges with anything already
  // registered and - crucially - survives subsequent native builder calls
  // (`.refine()`, `.min()`, `.optional()`, ...), each of which returns a new
  // cloned schema instance under Zod v4. A plain property assignment (as
  // used under Zod v3) would be silently dropped by that clone.
  const UNIQUE_SUPPORT_LIST = [z_0.ZodString, z_0.ZodNumber, z_0.ZodDate] as const;

  for (const type of UNIQUE_SUPPORT_LIST) {
    (<any>type.prototype).unique = function (arg = true) {
      return this.meta({ ...this.meta(), __zm_unique: arg });
    };

    (<any>type.prototype).sparse = function (arg = true) {
      return this.meta({ ...this.meta(), __zm_sparse: arg });
    };
  }
}

export type TzmId = ReturnType<typeof createId> & {
  unique: (arg?: boolean) => TzmId;
  sparse: (arg?: boolean) => TzmId;
  ref: (arg: string) => TzmId;
  refPath: (arg: string) => TzmId;
};

const createId = () => {
  return z
    .string()
    .refine((v) => isValidObjectId(v), { message: "Invalid ObjectId" })
    .or(z.instanceof(Types.ObjectId));
};

export const zId = (ref?: string): TzmId => {
  const output = createId();

  (<any>output).__zm_type = "ObjectId";
  (<any>output).__zm_ref = ref;

  (<any>output).ref = function (ref: string) {
    (<any>this).__zm_ref = ref;
    return this;
  };

  (<any>output).refPath = function (ref: string) {
    (<any>this).__zm_refPath = ref;
    return this;
  };

  (<any>output).unique = function (val = true) {
    (<any>this).__zm_unique = val;
    return this;
  };

  (<any>output).sparse = function (val = true) {
    (<any>this).__zm_sparse = val;
    return this;
  };

  return output as TzmId;
};

export type TzmUUID = ReturnType<typeof createUUID> & {
  unique: (arg?: boolean) => TzmUUID;
  sparse: (arg?: boolean) => TzmUUID;
  ref: (arg: string) => TzmUUID;
  refPath: (arg: string) => TzmUUID;
};

const createUUID = () => {
  return z.string().uuid({ message: "Invalid UUID" }).or(z.instanceof(Types.UUID));
};

export const zUUID = (ref?: string): TzmUUID => {
  const output = createUUID();

  (<any>output).__zm_type = "UUID";
  (<any>output).__zm_ref = ref;

  (<any>output).ref = function (ref: string) {
    (<any>this).__zm_ref = ref;
    return this;
  };

  (<any>output).refPath = function (ref: string) {
    (<any>this).__zm_refPath = ref;
    return this;
  };

  (<any>output).unique = function (val = true) {
    (<any>this).__zm_unique = val;
    return this;
  };

  (<any>output).sparse = function (val = true) {
    (<any>this).__zm_sparse = val;
    return this;
  };

  return output as TzmUUID;
};
