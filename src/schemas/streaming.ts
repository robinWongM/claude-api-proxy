import { z } from "zod";
import {
	AnthropicContentBlockSchema,
	AnthropicMessagesResponseSchema,
	AnthropicUsageSchema,
} from "./anthropic.ts";

export const AnthropicStreamEventSchema = z.union([
	z.object({
		type: z.literal("message_start"),
		message: AnthropicMessagesResponseSchema.partial(),
	}),
	z.object({
		type: z.literal("content_block_start"),
		index: z.number().int().min(0),
		content_block: AnthropicContentBlockSchema,
	}),
	z.object({
		type: z.literal("content_block_delta"),
		index: z.number().int().min(0),
		delta: z.object({ type: z.literal("text_delta"), text: z.string() }),
	}),
	z.object({
		type: z.literal("content_block_stop"),
		index: z.number().int().min(0),
	}),
	z.object({
		type: z.literal("message_delta"),
		delta: z
			.object({
				stop_reason: z
					.enum(["end_turn", "max_tokens", "stop_sequence", "tool_use"])
					.optional(),
				stop_sequence: z.string().nullable().optional(),
			})
			.optional(),
		usage: AnthropicUsageSchema.partial().optional(),
	}),
	z.object({ type: z.literal("message_stop") }),
]);

export type AnthropicStreamEvent = z.infer<typeof AnthropicStreamEventSchema>;
