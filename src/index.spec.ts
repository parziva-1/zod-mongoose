import { model, Schema, SchemaTypes, Types } from "mongoose";
import { z } from "zod";
import zodSchema, { extendZod, zId, zodSchemaRaw, zUUID } from "./index";

extendZod(z);

enum StatusEnum {
  ONLINE = "online",
  OFFLINE = "offline",
  IDLE = "idle",
}

const SUBDOCUMENT_SCHEMA = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(3).max(255),
  createdAt: z.date(),
});

const EXAMPLE_SCHEMA = z.object({
  name: z.string().min(3).max(255),
  age: z.number().min(18).max(100),
  active: z.boolean().default(false),
  access: z.enum(["admin", "user"]).default("user"),
  unique_num: z.number().unique(),
  unique_sparse_num: z.number().unique().sparse(),
  wearable: zUUID().unique().sparse(),
  wearableWithRef: zUUID("Devices").unique(),
  wearableWithPath: zUUID().unique().refPath("device"),
  devices: zUUID().array(),
  companyId: zId("Company"),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.enum(["CA", "NY", "TX"]),
  }),
  tags: z.string().min(3).max(255).array(),
  filters: z.array(z.string()).default(["default_filter"]),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  last_known_device: zUUID().optional(),
  phone: z
    .string()
    .unique()
    .refine((v) => v.length === 10, "Must be a valid phone number"),
  email: z.string().unique().sparse(),
  email_unique: z.string().unique(),
  curator: zId().optional(),
  unique_id: zId().unique(),
  unique_id_sparse: zId().unique().sparse(),
  unique_date: z.date().unique().sparse(),
  nullable_field: z.string().nullable(),
  hashes: z
    .string()
    .refine((val) => val.startsWith("oi"), { message: "Custom message" })
    .array(),

  posts: z.array(SUBDOCUMENT_SCHEMA),
  keys: z.map(z.string(), z.object({ value: z.number() })),
  number_map: z.map(z.number(), z.object({ value: z.number() })),
  access_map: z.map(z.enum(["admin", "user"]), z.object({ value: z.number() })),
  sessions: z.record(z.date(), z.string()),
  notes: z.any(),
  devices_last_seen: z.record(zUUID(), z.date()),
  last_contacted: z.record(zId(), z.date()),

  status: z.nativeEnum(StatusEnum).default(StatusEnum.ONLINE),
});

const schema = zodSchema(EXAMPLE_SCHEMA);
// console.log(schema.obj);

describe("Overall", () => {
  test("Smoke test", () => {
    expect(schema).toBeDefined();
  });

  test("zodSchema should return a mongoose schema", () => {
    expect(schema).toBeInstanceOf(Schema);
  });

  test("zodSchema should contain all fields", () => {
    for (const key of Object.keys(EXAMPLE_SCHEMA.shape)) {
      expect(key in schema.obj).toBe(true);
    }
  });

  test("zodSchemaRaw should contain all fields", () => {
    const obj = zodSchemaRaw(EXAMPLE_SCHEMA);
    for (const key of Object.keys(EXAMPLE_SCHEMA.shape)) {
      expect(key in obj).toBe(true);
    }
  });

  test("zodSchema should support mongoose field options", () => {
    const schema = zodSchemaRaw(EXAMPLE_SCHEMA);
    schema.phone.index = true;

    expect(schema.phone.index).toBe(true);
  });
});

describe("ID Helpers", () => {
  // General
  test("zId() should represent valid ObjectID", () => {
    const id = new Types.ObjectId();
    const parsed = zId().safeParse(id);

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Zod check failed");
    expect(parsed.data).toBe(id);
  });

  test("zId() should represent a string in ObjectID format", () => {
    const id = new Types.ObjectId().toString();
    const parsed = zId().safeParse(id);

    if (!parsed.success) throw new Error("Zod check failed");
    expect(parsed.data).toBe(id);
  });

  test("zUUID() should represent a valid UUID", () => {
    const id = new Types.UUID();
    const parsed = zUUID().safeParse(id);

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Zod check failed");
    expect(parsed.data).toBe(id);
  });

  test("zId() should not represent an invalid ObjectID", () => {
    const id = "invalid";
    const parsed = zId().safeParse(id);
    expect(parsed.success).toBe(false);
  });

  test("zUUID() should not represent an invalid UUID", () => {
    const id = "invalid";
    const parsed = zUUID().safeParse(id);
    expect(parsed.success).toBe(false);
  });

  test("zId() should not represent an invalid UUID", () => {
    const id = new Types.UUID();
    const parsed = zId().safeParse(id);
    expect(parsed.success).toBe(false);
  });

  test("zUUID() should not represent an invalid ObjectID", () => {
    const id = new Types.ObjectId();
    const parsed = zUUID().safeParse(id);
    expect(parsed.success).toBe(false);
  });

  test("zId() should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zId().optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.ObjectId);
    expect((<any>schema.obj.id).required).toBe(false);
  });

  test("zId(ref) should define reference when created", () => {
    const schema = zodSchema(
      z.object({
        id: zId("Company"),
      }),
    );

    expect((<any>schema.obj.id).ref).toBe("Company");
  });

  test("zId(ref) should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zId("Company").optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.ObjectId);
    expect((<any>schema.obj.id).required).toBe(false);
    expect((<any>schema.obj.id).ref).toBe("Company");
  });

  test("zId().ref(ref) should define reference", () => {
    const schema = zodSchema(
      z.object({
        id: zId().ref("Company"),
      }),
    );

    expect((<any>schema.obj.id).ref).toBe("Company");
  });

  test("zId().ref(ref) should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zId().ref("Company").optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.ObjectId);
    expect((<any>schema.obj.id).required).toBe(false);
    expect((<any>schema.obj.id).ref).toBe("Company");
  });

  test("zId().refPath(ref) should define reference path", () => {
    const schema = zodSchema(
      z.object({
        id: zId().refPath("company"),
      }),
    );

    expect((<any>schema.obj.id).refPath).toBe("company");
  });

  test("zId().refPath(ref) should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zId().refPath("company").optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.ObjectId);
    expect((<any>schema.obj.id).required).toBe(false);
    expect((<any>schema.obj.id).refPath).toBe("company");
  });

  test("zUUID() should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID().optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.UUID);
    expect((<any>schema.obj.id).required).toBe(false);
  });

  test("zUUID(ref) should define reference when created", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID("Device"),
      }),
    );

    expect((<any>schema.obj.id).ref).toBe("Device");
  });

  test("zUUID(ref) should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID().ref("Device").optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.UUID);
    expect((<any>schema.obj.id).required).toBe(false);
  });

  test("zUUID().ref(ref) should define reference", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID().ref("Device"),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.UUID);
    expect((<any>schema.obj.id).ref).toBe("Device");
  });

  test("zUUID().ref(ref) should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID().ref("Device").optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.UUID);
    expect((<any>schema.obj.id).required).toBe(false);
    expect((<any>schema.obj.id).ref).toBe("Device");
  });

  test("zUUID().refPath(ref) should define reference path", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID().refPath("device"),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.UUID);
    expect((<any>schema.obj.id).refPath).toBe("device");
  });

  test("zUUID().refPath(ref) should support being optional", () => {
    const schema = zodSchema(
      z.object({
        id: zUUID().refPath("device").optional(),
      }),
    );

    expect((<any>schema.obj.id).type).toBe(SchemaTypes.UUID);
    expect((<any>schema.obj.id).required).toBe(false);
    expect((<any>schema.obj.id).refPath).toBe("device");
  });
});

describe("Unsupported types", () => {
  test("Union should pickup first type from union only", () => {
    const schema = z.object({
      field: z.union([z.string(), z.number()]),
    });

    const { obj } = zodSchema(schema);
    if (!obj.field) throw new Error("No field definition");

    expect((<any>obj.field).type).toBe(String);
  });

  test("z.unknown() is supported and maps to Mixed", () => {
    // Previously unsupported (threw); z.unknown() now maps to Mixed the
    // same way z.any() does.
    const schema = z.object({
      field: z.unknown(),
    });

    const { obj } = zodSchema(schema);
    expect((<any>obj.field).type).toBe(SchemaTypes.Mixed);
  });

  test("Unsupported Map key should not throw an error", () => {
    const schema = z.object({
      field: z.map(z.unknown(), z.string()),
    });

    expect(() => zodSchema(schema)).not.toThrow();
    const { obj } = zodSchema(schema);

    expect((<any>obj.field).type).toBe(Map);
  });
});

describe("Supported types", () => {
  test("String should have correct type", () => {
    if (!schema.obj.name) throw new Error("No name definition");

    expect((<any>schema.obj.name).type).toBe(String);
  });

  test("Number should have correct type", () => {
    if (!schema.obj.age) throw new Error("No age definition");

    expect((<any>schema.obj.age).type).toBe(Number);
  });

  test("Boolean should have correct type", () => {
    if (!schema.obj.active) throw new Error("No active definition");

    expect((<any>schema.obj.active).type).toBe(Boolean);
  });

  test("Date should have correct type", () => {
    if (!schema.obj.createdAt) throw new Error("No createdAt definition");

    expect((<any>schema.obj.createdAt).type).toBe(Date);
  });

  test("ObjectId should have correct type", () => {
    if (!schema.obj.companyId) throw new Error("No companyId definition");

    expect((<any>schema.obj.companyId).type).toBe(SchemaTypes.ObjectId);
  });

  test("UUID should have correct type", () => {
    if (!schema.obj.wearable) throw new Error("No wearable definition");

    expect((<any>schema.obj.wearable).type).toBe(SchemaTypes.UUID);
  });

  test("Array should have correct type", () => {
    if (!schema.obj.tags) throw new Error("No tags definition");

    expect(Array.isArray((<any>schema.obj.tags).type)).toBe(true);
    expect((<any>schema.obj.tags).type[0].type).toBe(String);
  });

  test("Enum should have correct type", () => {
    if (!schema.obj.access) throw new Error("No access definition");

    expect((<any>schema.obj.access).type).toBe(String);
    expect((<any>schema.obj.access).enum).toEqual(["admin", "user"]);
  });

  test("Native enum should have correct type", () => {
    if (!schema.obj.status) throw new Error("No status definition");

    expect((<any>schema.obj.status).type).toBe(String);
    expect((<any>schema.obj.status).enum).toEqual(Object.values(StatusEnum));
  });

  test("Object should have correct type", () => {
    if (!schema.obj.address) throw new Error("No address definition");

    for (const key of Object.keys(schema.obj.address)) {
      expect((<any>schema.obj.address)[key].type).toBe(String);
    }

    expect((<any>schema.obj.address).street.type).toBe(String);
    expect((<any>schema.obj.address).city.type).toBe(String);
    expect((<any>schema.obj.address).state.type).toBe(String);
  });

  test("Map should have correct type", () => {
    if (!schema.obj.keys) throw new Error("No keys definition");

    expect((<any>schema.obj.keys).type).toBe(Map);
    expect((<any>schema.obj.number_map).type).toBe(Map);
    expect((<any>schema.obj.access_map).type).toBe(Map);

    expect((<any>schema.obj.keys).of.value.type).toBe(Number);
    expect((<any>schema.obj.number_map).of.value.type).toBe(Number);
    expect((<any>schema.obj.access_map).of.value.type).toBe(Number);

    expect((<any>schema.obj.sessions).of.type).toBe(String);
  });

  test("Record should have correct type", () => {
    if (!schema.obj.sessions) throw new Error("No sessions definition");

    expect((<any>schema.obj.sessions).type).toBe(Map);
    expect((<any>schema.obj.sessions).of.type).toBe(String);
  });

  test("Complex Record should have correct type", () => {
    if (!schema.obj.sessions) throw new Error("No sessions definition");

    expect((<any>schema.obj.devices_last_seen).type).toBe(Map);
    expect((<any>schema.obj.devices_last_seen).of.type).toBe(Date);

    expect((<any>schema.obj.last_contacted).type).toBe(Map);
    expect((<any>schema.obj.last_contacted).of.type).toBe(Date);
  });

  test("partial should work", () => {
    const zObj = z
      .object({
        name: z.string().min(5),
        age: z.number().min(10),
        email: z.string().email(),
        optedIn: z.boolean().default(false),
        tel: z.string().optional(),
      })
      .partial();

    const schema = zodSchema(zObj);

    expect((<any>schema.obj.name).required).toBe(false);
    expect((<any>schema.obj.age).required).toBe(false);
    expect((<any>schema.obj.email).required).toBe(false);
    expect((<any>schema.obj.optedIn).required).toBe(false);
    expect((<any>schema.obj.tel).required).toBe(false);
  });

  test("Array of objects should have correct type", () => {
    if (!schema.obj.posts) throw new Error("No posts definition");

    expect(Array.isArray((<any>schema.obj.posts).type)).toBe(true);
    for (const key of Object.keys(SUBDOCUMENT_SCHEMA.shape)) {
      expect(key in (<any>schema.obj.posts).type[0]).toBe(true);
    }
  });

  test("Array should have correct default value", () => {
    if (!schema.obj.filters) throw new Error("No roles definition");

    expect((<any>schema.obj.filters).default()).toEqual(["default_filter"]);
  });

  test("Boolean field should have correct default value", () => {
    if (!schema.obj.active) throw new Error("No active definition");

    expect((<any>schema.obj.active).default()).toBe(false);
  });

  test("Enum field should have correct default value", () => {
    if (!schema.obj.access) throw new Error("No access definition");

    expect((<any>schema.obj.access).default()).toBe("user");
  });

  test("Native enum field should have correct default value", () => {
    if (!schema.obj.status) throw new Error("No status definition");

    expect((<any>schema.obj.status).default()).toBe(StatusEnum.ONLINE);
  });

  test("ZodAny field should have correct type - Mixed", () => {
    if (!schema.obj.notes) throw new Error("No notes definition");

    expect((<any>schema.obj.notes).type).toBe(SchemaTypes.Mixed);
  });
});

describe("Validation", () => {
  test("String should have correct validation", () => {
    if (!schema.obj.name) throw new Error("No name definition");

    expect((<any>schema.obj.name).minLength).toBe(3);
    expect((<any>schema.obj.name).maxLength).toBe(255);
  });

  test("Number should have correct validation", () => {
    if (!schema.obj.age) throw new Error("No age definition");

    expect((<any>schema.obj.age).min).toBe(18);
    expect((<any>schema.obj.age).max).toBe(100);
  });

  test("String array should have correct validation", () => {
    if (!schema.obj.tags) throw new Error("No tags definition");

    expect((<any>schema.obj.tags).type[0].minLength).toBe(3);
    expect((<any>schema.obj.tags).type[0].maxLength).toBe(255);
  });

  test("Optional fields should have correct validation", () => {
    if (!schema.obj.updatedAt) throw new Error("No updatedAt definition");

    expect((<any>schema.obj.updatedAt).required).toBe(false);
    expect((<any>schema.obj.last_known_device).required).toBe(false);
    expect((<any>schema.obj.curator).required).toBe(false);
  });

  test("Nested refinements should work as expected", () => {
    expect((<any>schema.obj.hashes).type[0].validate).toBeDefined();
    expect((<any>schema.obj.hashes).type[0].validate.validator).toBeInstanceOf(Function);
    expect((<any>schema.obj.hashes).type[0].validate.message).toBeDefined();
  });

  test("Strings refinements should be defined", () => {
    expect((<any>schema.obj.phone).validate).toBeDefined();
    expect((<any>schema.obj.phone).validate.validator).toBeInstanceOf(Function);
    expect((<any>schema.obj.phone).validate.message).toBeDefined();
  });

  test("Unique string schema", () => {
    expect((<any>schema.obj.phone).unique).toBe(true);
    expect((<any>schema.obj.name).unique).toBe(false);
    expect((<any>schema.obj.email).unique).toBe(true);
    expect((<any>schema.obj.email_unique).unique).toBe(true);
  });

  test("Unique number schema", () => {
    expect((<any>schema.obj.unique_num).unique).toBe(true);
    expect((<any>schema.obj.unique_sparse_num).unique).toBe(true);
    expect((<any>schema.obj.age).unique).toBe(false);
  });

  test("Unique date schema", () => {
    expect((<any>schema.obj.unique_date).unique).toBe(true);
    expect((<any>schema.obj.createdAt).unique).toBeFalsy();
    expect((<any>schema.obj.updatedAt).unique).toBeFalsy();
  });

  test("Unique objectId schema", () => {
    expect((<any>schema.obj.unique_id).unique).toBe(true);
    expect((<any>schema.obj.unique_id_sparse).unique).toBe(true);
    expect((<any>schema.obj.companyId).unique).toBeFalsy();
  });

  test("Unique mongoUUID schema", () => {
    expect((<any>schema.obj.wearable).unique).toBe(true);
  });

  test("Sparse string schema", () => {
    expect((<any>schema.obj.email).sparse).toBe(true);
    expect((<any>schema.obj.email_unique).sparse).toBe(false);
    expect((<any>schema.obj.name).sparse).toBe(false);
  });

  test("Sparse number schema", () => {
    expect((<any>schema.obj.unique_sparse_num).sparse).toBe(true);
    expect((<any>schema.obj.unique_num).sparse).toBe(false);
    expect((<any>schema.obj.age).sparse).toBe(false);
  });

  test("Sparse date schema", () => {
    expect((<any>schema.obj.unique_date).sparse).toBe(true);
    expect((<any>schema.obj.createdAt).sparse).toBeFalsy();
    expect((<any>schema.obj.updatedAt).sparse).toBeFalsy();
  });

  test("Sparse objectId schema", () => {
    expect((<any>schema.obj.unique_id_sparse).sparse).toBe(true);
    expect((<any>schema.obj.unique_id).sparse).toBeFalsy();
    expect((<any>schema.obj.companyId).sparse).toBeFalsy();
  });

  test("Sparse mongoUUID schema", () => {
    expect((<any>schema.obj.wearable).sparse).toBe(true);
  });

  test("Optional nested objects should have correct required field", () => {
    const NestedSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    const MainSchema = z.object({
      title: z.string(),
      optionalNested: NestedSchema.optional(),
      requiredNested: NestedSchema,
    });

    const schema = zodSchema(MainSchema);

    // The optional object should not be required
    expect((<any>schema.obj.optionalNested).required).toBe(false);
    expect((<any>schema.obj.optionalNested).type).toBeDefined();
    expect((<any>schema.obj.optionalNested).type.name.type).toBe(String);
    expect((<any>schema.obj.optionalNested).type.value.type).toBe(Number);

    // The required object should NOT have the required property at the top level
    expect((<any>schema.obj.requiredNested).required).toBeUndefined();
    expect((<any>schema.obj.requiredNested).name.type).toBe(String);
    expect((<any>schema.obj.requiredNested).value.type).toBe(Number);
  });

  test("Nullable field should be nullable", () => {
    expect((<any>schema.obj.nullable_field).required).toBe(false);
    expect((<any>schema.obj.nullable_field).default()).toBe(null);
  });
});

describe("Default values", () => {
  test("Static default value should be preserved for string fields", () => {
    const zObj = z.object({
      role: z.string().default("member"),
    });
    const schema = zodSchema(zObj);

    expect((<any>schema.obj.role).type).toBe(String);
    expect((<any>schema.obj.role).required).toBe(true);
    expect(typeof (<any>schema.obj.role).default).toBe("function");
    expect((<any>schema.obj.role).default()).toBe("member");
  });

  test("Factory-function default should be re-evaluated on every call", () => {
    let counter = 0;
    const zObj = z.object({
      seq: z.number().default(() => ++counter),
    });
    const schema = zodSchema(zObj);

    expect(typeof (<any>schema.obj.seq).default).toBe("function");
    expect((<any>schema.obj.seq).default()).toBe(1);
    expect((<any>schema.obj.seq).default()).toBe(2);
    expect((<any>schema.obj.seq).default()).toBe(3);
  });

  test("Factory-function default returning an array should produce a fresh array per call", () => {
    const zObj = z.object({
      tags: z.array(z.string()).default(() => ["seed"]),
    });
    const schema = zodSchema(zObj);

    const first = (<any>schema.obj.tags).default();
    const second = (<any>schema.obj.tags).default();

    expect(first).toEqual(["seed"]);
    expect(first).not.toBe(second);
  });
});

describe("Optional + nullable combinations", () => {
  test("optional().nullable() should be not required with a null default", () => {
    const zObj = z.object({
      note: z.string().optional().nullable(),
    });
    const schema = zodSchema(zObj);

    expect((<any>schema.obj.note).type).toBe(String);
    expect((<any>schema.obj.note).required).toBe(false);
  });

  test("nullable().optional() should be not required with a null default", () => {
    const zObj = z.object({
      note: z.string().nullable().optional(),
    });
    const schema = zodSchema(zObj);

    expect((<any>schema.obj.note).type).toBe(String);
    expect((<any>schema.obj.note).required).toBe(false);
  });

  test("nullable() with an explicit default should keep the provided default over null", () => {
    const zObj = z.object({
      status: z.string().nullable().default("active"),
    });
    const schema = zodSchema(zObj);

    expect((<any>schema.obj.status).required).toBe(false);
    expect((<any>schema.obj.status).default()).toBe("active");
  });

  test("bare nullable() without a default falls back to a null default", () => {
    const zObj = z.object({
      status: z.string().nullable(),
    });
    const schema = zodSchema(zObj);

    expect((<any>schema.obj.status).required).toBe(false);
    expect((<any>schema.obj.status).default()).toBe(null);
  });
});

describe("Preprocess and transform effects", () => {
  test("Preprocess effects", () => {
    const zToNumberPreprocess = z.object({
      value: z.coerce.number(),
    });
    const zToDatePreprocess = z.object({
      value: z.preprocess((val) => {
        if (typeof val === "string" && !Number.isNaN(Date.parse(val))) {
          return new Date(val);
        }
        return val;
      }, z.date()),
    });

    const toNumberPreprocessSchema = zodSchema(zToNumberPreprocess);
    const toDatePreprocessSchema = zodSchema(zToDatePreprocess);

    expect((<any>toNumberPreprocessSchema.obj.value).type).toBe(Number);
    expect((<any>toDatePreprocessSchema.obj.value).type).toBe(Date);
  });

  test("Transform effects", () => {
    const zUpcaseTransform = z.object({
      name: z.string().transform((val) => val.toUpperCase()),
    });

    const zNumberAddTransform = z.object({
      count: z.number().transform((val) => val + 1),
    });

    const upcaseTransformSchema = zodSchema(zUpcaseTransform);
    const numberAddTransformSchema = zodSchema(zNumberAddTransform);

    expect((<any>upcaseTransformSchema.obj.name).type).toBe(String);
    expect((<any>numberAddTransformSchema.obj.count).type).toBe(Number);
  });

  test("Refine-before-transform is preserved", () => {
    const zObj = z.object({
      value: z
        .string()
        .refine((v) => v.length > 2, "too short before")
        .transform((v) => v.toUpperCase()),
    });

    const schema = zodSchema(zObj);

    expect((<any>schema.obj.value).validate).toBeDefined();
    expect((<any>schema.obj.value).validate.validator).toBeInstanceOf(Function);
    expect((<any>schema.obj.value).validate.message).toBe("too short before");
  });

  test("Refine-after-transform is preserved", () => {
    const zObj = z.object({
      value: z
        .string()
        .transform((v) => v.toUpperCase())
        .refine((v) => v.length < 10, "too long after"),
    });

    const schema = zodSchema(zObj);

    expect((<any>schema.obj.value).validate).toBeDefined();
    expect((<any>schema.obj.value).validate.validator).toBeInstanceOf(Function);
    expect((<any>schema.obj.value).validate.message).toBe("too long after");
  });

  test("refine-before-and-after-transform: both refinements are enforced", () => {
    // A schema refined both before AND after a single `.transform()` used to
    // silently drop the post-transform refinement (see CHANGELOG / git
    // history for the "KNOWN GAP" this test used to pin). `parseField` now
    // collects `.refine()` checks from every node it walks across a
    // `ZodPipe` and merges them into a `validate` array, so Mongoose runs
    // both. Prove it at the Mongoose validation level, not just structurally.
    const zObj = z.object({
      value: z
        .string()
        .refine((v) => v.length > 2, "too short before")
        .transform((v) => v.toUpperCase())
        .refine((v) => v.length < 10, "too long after"),
    });

    const schema = zodSchema(zObj);
    const Model = model("RefineBeforeAndAfterTransform", schema);

    expect(Array.isArray((<any>schema.obj.value).validate)).toBe(true);
    expect((<any>schema.obj.value).validate).toHaveLength(2);

    // Fails the pre-transform check ("ab" has length 2, not > 2).
    const tooShort = new Model({ value: "ab" });
    const shortErr = tooShort.validateSync();
    expect(shortErr?.errors.value?.message).toContain("too short before");

    // Passes the pre-transform check, but the transformed (upper-cased)
    // value is too long for the post-transform check to accept.
    const tooLong = new Model({ value: "abcdefghij" });
    const longErr = tooLong.validateSync();
    expect(longErr?.errors.value?.message).toContain("too long after");

    // Passes both checks.
    const ok = new Model({ value: "abc" });
    expect(ok.validateSync()).toBeUndefined();
  });
});

describe("z.unknown() / z.any()", () => {
  test("both map to Mixed and accept any value", () => {
    const zObj = z.object({
      a: z.any(),
      u: z.unknown(),
    });
    const schema = zodSchema(zObj);
    const Model = model("AnyUnknownMixed", schema);

    expect((<any>schema.obj.a).type).toBe(SchemaTypes.Mixed);
    expect((<any>schema.obj.u).type).toBe(SchemaTypes.Mixed);

    const doc = new Model({ a: { nested: true }, u: [1, 2, 3] });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe("z.tuple()", () => {
  test("enforces per-position types and exact arity", () => {
    const zObj = z.object({
      point: z.tuple([z.number(), z.number(), z.string()]),
    });
    const schema = zodSchema(zObj);
    const Model = model("TupleFixedArity", schema);

    expect(Array.isArray((<any>schema.obj.point).type)).toBe(true);

    const valid = new Model({ point: [1, 2, "label"] });
    expect(valid.validateSync()).toBeUndefined();

    const wrongType = new Model({ point: [1, "two", "label"] });
    expect(wrongType.validateSync()?.errors.point).toBeDefined();

    const wrongLength = new Model({ point: [1, 2] });
    expect(wrongLength.validateSync()?.errors.point).toBeDefined();

    const tooLong = new Model({ point: [1, 2, "label", "extra"] });
    expect(tooLong.validateSync()?.errors.point).toBeDefined();
  });

  test("supports a rest element for variable-length tuples", () => {
    const zObj = z.object({
      row: z.tuple([z.string()]).rest(z.number()),
    });
    const schema = zodSchema(zObj);
    const Model = model("TupleWithRest", schema);

    const valid = new Model({ row: ["label", 1, 2, 3] });
    expect(valid.validateSync()).toBeUndefined();

    const minimal = new Model({ row: ["label"] });
    expect(minimal.validateSync()).toBeUndefined();

    const badRest = new Model({ row: ["label", 1, "not-a-number"] });
    expect(badRest.validateSync()?.errors.row).toBeDefined();

    const missingRequired = new Model({ row: [] });
    expect(missingRequired.validateSync()?.errors.row).toBeDefined();
  });
});
