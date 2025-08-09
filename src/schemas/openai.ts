import { z } from "zod";

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
	function: z.object({ name: z.string(), arguments: z.string() }),
});

export const OpenAIMessageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.union([
		z.string(),
		z.array(
			z.union([
				z.object({ type: z.literal("text"), text: z.string() }),
				z.object({
					type: z.literal("image_url"),
					image_url: z.object({ url: z.string() }),
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
				function: z.object({ name: z.string() }),
			}),
		])
		.optional(),
});

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
