---
"@parziva-1/zod-mongoose": patch
---

Fix `toPartialUpdateSchema()`'s inferred output type: each field now keeps its specific Zod type (enum literal union, string, number, nested object, ...) instead of collapsing to a generic `ZodType`. Runtime behavior is unchanged — this only fixes TypeScript inference, which was severe enough to break real call sites (e.g. `body.status` inferring as `{}`, which broke `allowed.includes(body.status)` when adopting this in spybee-backend-v3-hono).
