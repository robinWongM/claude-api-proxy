import { z } from "zod";

// Cache control used across many content blocks and tools
export const CacheControlEphemeralSchema = z.object({
	type: z.literal("ephemeral"),
	ttl: z.enum(["5m", "1h"]).optional(),
});

export const CacheControlSchema = z.discriminatedUnion("type", [
	CacheControlEphemeralSchema,
]);

export type CacheControl = z.infer<typeof CacheControlSchema>;
