import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const saveRawLog = mutation({
  args: { prompt: v.string(), response: v.string(), metadata: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("rawLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
