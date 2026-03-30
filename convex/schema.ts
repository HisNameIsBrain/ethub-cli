import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rawLogs: defineTable({
    prompt: v.string(),
    response: v.string(),
    metadata: v.any(),
    timestamp: v.number(),
  }),
});
