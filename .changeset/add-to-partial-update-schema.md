---
"@parziva-1/zod-mongoose": minor
---

Add `toPartialUpdateSchema()` to safely build a PUT/PATCH request-body schema from a full model schema.

Reusing a model field directly as `ModelSchema.shape.field.optional()` (or calling `.partial()` on the whole model schema) for a partial-update body looks safe but isn't under Zod v4: chaining `.optional()` onto a `ZodDefault` does not make an absent field parse to `undefined` — it still applies the inner default. A handler that then mass-writes the parsed body (`doc.set(body)`, `Model.findByIdAndUpdate(id, body)`, ...) ends up silently resetting every omitted defaulted field back to its default value on every partial update, clobbering whatever was actually stored.

`toPartialUpdateSchema(schema)` walks a model schema's fields, strips any `.default()` wherever it appears in the chain (including nested inside `.optional()`/`.nullable()`), and re-wraps each field in `.optional()` — so an absent field genuinely means "leave unchanged" downstream.
