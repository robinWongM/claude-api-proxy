import { z } from "zod";

// Base content block schemas
export const AnthropicTextContentSchema = z.object({
	type: z.literal("text"),
	text: z.string(),
});

export const AnthropicImageContentSchema = z.object({
	type: z.literal("image"),
	source: z.object({
		type: z.literal("base64"),
		media_type: z.string(),
		data: z.string(),
	}),
});

export const AnthropicToolUseContentSchema = z.object({
	type: z.literal("tool_use"),
	id: z.string(),
	name: z.string(),
	input: z.record(z.any()),
});

export const AnthropicToolResultContentSchema = z.object({
	type: z.literal("tool_result"),
	tool_use_id: z.string(),
	content: z.union([z.string(), z.array(z.any())]),
	is_error: z.boolean().optional(),
});

export const AnthropicContentBlockSchema = z.union([
	AnthropicTextContentSchema,
	AnthropicImageContentSchema,
	AnthropicToolUseContentSchema,
	AnthropicToolResultContentSchema,
]);

// Cache control schema
export const CacheControlSchema = z.object({
	type: z.enum(["ephemeral"]),
	ttl_seconds: z.number().min(60).max(3600).optional(), // 1 minute to 1 hour
});

// Message schema with cache control
export const AnthropicMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.union([z.string(), z.array(AnthropicContentBlockSchema)]),
	cache_control: CacheControlSchema.optional(),
});

// Tool definition schema
export const AnthropicToolSchema = z.object({
	name: z.string(),
	description: z.string(),
	input_schema: z.object({
		type: z.literal("object"),
		properties: z.record(z.any()),
		required: z.array(z.string()).optional(),
	}),
	cache_control: CacheControlSchema.optional(),
});

// Main request schema
export const AnthropicMessagesRequestSchema = z.object({
	model: z.string().min(1),
	messages: z.array(AnthropicMessageSchema).min(1),
	max_tokens: z.number().int().min(1),
	temperature: z.number().min(0).max(2).optional(),
	top_p: z.number().min(0).max(1).optional(),
	top_k: z.number().int().min(1).optional(),
	stop_sequences: z.array(z.string()).max(4).optional(),
	stream: z.boolean().optional(),
	system: z
		.union([
			z.string(),
			z.array(
				z.object({
					type: z.literal("text"),
					text: z.string(),
					cache_control: CacheControlSchema.optional(),
				}),
			),
		])
		.optional(),
	metadata: z
		.object({
			user_id: z.string().optional(),
		})
		.optional(),
	tools: z.array(AnthropicToolSchema).optional(),
});

// Response schemas
export const AnthropicUsageSchema = z.object({
	input_tokens: z.number().int().min(0),
	output_tokens: z.number().int().min(0),
	cache_creation_input_tokens: z.number().int().min(0).optional(),
	cache_read_input_tokens: z.number().int().min(0).optional(),
});

export const AnthropicMessagesResponseSchema = z.object({
	id: z.string(),
	type: z.literal("message"),
	role: z.literal("assistant"),
	content: z.array(AnthropicContentBlockSchema),
	model: z.string(),
	stop_reason: z.enum(["end_turn", "max_tokens", "stop_sequence", "tool_use"]),
	stop_sequence: z.string().nullable(),
	usage: AnthropicUsageSchema,
});

// Models schemas
export const AnthropicModelSchema = z.object({
	id: z.string(),
	type: z.literal("model"),
	display_name: z.string(),
	created_at: z.string().datetime(),
});

export const AnthropicModelsResponseSchema = z.object({
	data: z.array(AnthropicModelSchema),
	has_more: z.boolean(),
	first_id: z.string().optional(),
	last_id: z.string().optional(),
});

// OpenAI tool schemas
export const OpenAIFunctionSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	parameters: z
		.object({
			type: z.literal("object"),
			properties: z.record(z.any()),
			required: z.array(z.string()).optional(),
		})
		.optional(),
});

export const OpenAIToolSchema = z.object({
	type: z.literal("function"),
	function: OpenAIFunctionSchema,
});

export const OpenAIToolCallSchema = z.object({
	id: z.string(),
	type: z.literal("function"),
	function: z.object({
		name: z.string(),
		arguments: z.string(),
	}),
});

export const OpenAIMessageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.union([
		z.string(),
		z.array(
			z.union([
				// Text content part
				z.object({
					type: z.literal("text"),
					text: z.string(),
				}),
				// Image URL content part (data URL or remote URL)
				z.object({
					type: z.literal("image_url"),
					image_url: z.object({
						url: z.string(),
					}),
				}),
			]),
		),
	]),
	name: z.string().optional(),
	tool_calls: z.array(OpenAIToolCallSchema).optional(),
	tool_call_id: z.string().optional(),
});

export const OpenAIChatCompletionRequestSchema = z.object({
	model: z.string().min(1),
	messages: z.array(OpenAIMessageSchema).min(1),
	temperature: z.number().min(0).max(2).optional(),
	top_p: z.number().min(0).max(1).optional(),
	n: z.number().int().min(1).max(128).optional(),
	stream: z.boolean().optional(),
	stop: z.union([z.string(), z.array(z.string())]).optional(),
	max_tokens: z.number().int().min(1).optional(),
	presence_penalty: z.number().min(-2).max(2).optional(),
	frequency_penalty: z.number().min(-2).max(2).optional(),
	logit_bias: z.record(z.number()).optional(),
	user: z.string().optional(),
	tools: z.array(OpenAIToolSchema).optional(),
	tool_choice: z
		.union([
			z.enum(["none", "auto"]),
			z.object({
				type: z.literal("function"),
				function: z.object({
					name: z.string(),
				}),
			}),
		])
		.optional(),
});

// Streaming event schemas
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
		delta: z.object({
			type: z.literal("text_delta"),
			text: z.string(),
		}),
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
	z.object({
		type: z.literal("message_stop"),
	}),
]);

// Error schema
export const AnthropicErrorSchema = z.object({
	type: z.literal("error"),
	error: z.object({
		type: z.enum([
			"invalid_request_error",
			"authentication_error",
			"permission_error",
			"not_found_error",
			"rate_limit_error",
			"api_error",
			"overloaded_error",
		]),
		message: z.string(),
		param: z.string().optional(),
		code: z.string().optional(),
	}),
});

// Type exports (inferred from schemas)
export type AnthropicMessagesRequest = z.infer<
	typeof AnthropicMessagesRequestSchema
>;
export type AnthropicMessagesResponse = z.infer<
	typeof AnthropicMessagesResponseSchema
>;
export type AnthropicModelsResponse = z.infer<
	typeof AnthropicModelsResponseSchema
>;
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;
export type AnthropicContentBlock = z.infer<typeof AnthropicContentBlockSchema>;
export type CacheControl = z.infer<typeof CacheControlSchema>;
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;
export type AnthropicStreamEvent = z.infer<typeof AnthropicStreamEventSchema>;
export type AnthropicError = z.infer<typeof AnthropicErrorSchema>;

export type OpenAIChatCompletionRequest = z.infer<
	typeof OpenAIChatCompletionRequestSchema
>;
export type OpenAIMessage = z.infer<typeof OpenAIMessageSchema>;
export type OpenAITool = z.infer<typeof OpenAIToolSchema>;
export type OpenAIFunction = z.infer<typeof OpenAIFunctionSchema>;
export type OpenAIToolCall = z.infer<typeof OpenAIToolCallSchema>;
export type OpenAIContentPart = NonNullable<
	Extract<z.infer<typeof OpenAIMessageSchema>["content"], any[]>
>[number];

// Validation helper functions
export function validateAnthropicMessagesRequest(
	data: unknown,
): AnthropicMessagesRequest {
	return AnthropicMessagesRequestSchema.parse(data);
}

export function validateOpenAIChatCompletionRequest(
	data: unknown,
): OpenAIChatCompletionRequest {
	return OpenAIChatCompletionRequestSchema.parse(data);
}

export function createValidationError(error: z.ZodError): AnthropicError {
	const firstError = error.errors[0];
	return {
		type: "error",
		error: {
			type: "invalid_request_error",
			message: `Invalid request: ${firstError.message} at ${firstError.path.join(".")}`,
			param: firstError.path.join("."),
		},
	};
}
