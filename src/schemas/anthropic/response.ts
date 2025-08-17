import { z } from "zod";
import { ResponseContentBlockSchema } from "./response-content.ts";

// Usage (response)
export const CacheCreationSchema = z.object({
	ephemeral_1h_input_tokens: z.number().int().min(0),
	ephemeral_5m_input_tokens: z.number().int().min(0),
});

export const ServerToolUsageSchema = z.object({
	web_search_requests: z.number().int().min(0),
});

export const UsageSchema = z.object({
	cache_creation: z.union([CacheCreationSchema, z.null()]).optional(),
	cache_creation_input_tokens: z
		.union([z.number().int().min(0), z.null()])
		.optional(),
	cache_read_input_tokens: z
		.union([z.number().int().min(0), z.null()])
		.optional(),
	input_tokens: z.number().int().min(0),
	output_tokens: z.number().int().min(0),
	server_tool_use: z.union([ServerToolUsageSchema, z.null()]).optional(),
	service_tier: z
		.union([z.enum(["standard", "priority", "batch"]), z.null()])
		.optional(),
});

// Container (response)
export const ContainerSchema = z.object({
	expires_at: z.string(),
	id: z.string(),
});

// Messages response
export const AnthropicMessagesResponseSchema = z.object({
	id: z.string(),
	type: z.literal("message"),
	role: z.literal("assistant"),
	content: z.array(ResponseContentBlockSchema),
	model: z.string().min(1).max(256),
	stop_reason: z.union([
		z.enum([
			"end_turn",
			"max_tokens",
			"stop_sequence",
			"tool_use",
			"pause_turn",
			"refusal",
		]),
		z.null(),
	]),
	stop_sequence: z.string().nullable(),
	usage: UsageSchema,
	container: z.union([ContainerSchema, z.null()]),
});

export type AnthropicMessagesResponse = z.infer<
	typeof AnthropicMessagesResponseSchema
>;
