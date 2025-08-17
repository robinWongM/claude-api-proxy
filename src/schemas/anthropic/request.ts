import { z } from "zod";
import {
	RequestContentBlockSchema,
	RequestTextBlockSchema,
} from "./request-content.ts";
import { AnthropicToolSchema } from "./tools.ts";

// Message
export const AnthropicMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.union([z.string(), z.array(RequestContentBlockSchema)]),
});

// MCP servers
export const RequestMCPServerToolConfigurationSchema = z.object({
	allowed_tools: z.array(z.string()).nullable().optional(),
	enabled: z.boolean().nullable().optional(),
});
export const RequestMCPServerURLDefinitionSchema = z.object({
	type: z.literal("url"),
	name: z.string(),
	url: z.string(),
	authorization_token: z.string().nullable().optional(),
	tool_configuration:
		RequestMCPServerToolConfigurationSchema.nullable().optional(),
});

// Tool choice
export const ToolChoiceAnySchema = z.object({
	type: z.literal("any"),
	disable_parallel_tool_use: z.boolean().optional(),
});
export const ToolChoiceAutoSchema = z.object({
	type: z.literal("auto"),
	disable_parallel_tool_use: z.boolean().optional(),
});
export const ToolChoiceNoneSchema = z.object({
	type: z.literal("none"),
});
export const ToolChoiceToolSchema = z.object({
	type: z.literal("tool"),
	name: z.string(),
	disable_parallel_tool_use: z.boolean().optional(),
});
export const ToolChoiceSchema = z.discriminatedUnion("type", [
	ToolChoiceAutoSchema,
	ToolChoiceAnySchema,
	ToolChoiceToolSchema,
	ToolChoiceNoneSchema,
]);

// Request - PASSED Human Verification
export const AnthropicMessagesRequestSchema = z.object({
	model: z.string().min(1).max(256),
	messages: z.array(AnthropicMessageSchema),
	max_tokens: z.number().int().min(1),
	container: z.string().nullable().optional(),
	mcp_servers: z.array(RequestMCPServerURLDefinitionSchema).optional(),
	metadata: z
		.object({
			user_id: z.string().max(256).nullable().optional(),
		})
		.optional(),
	service_tier: z.enum(["auto", "standard_only"]).optional(),
	stop_sequences: z.array(z.string()).optional(),
	stream: z.boolean().optional(),
	system: z.union([z.string(), z.array(RequestTextBlockSchema)]).optional(),
	temperature: z.number().min(0).max(1).optional(),
	thinking: z
		.discriminatedUnion("type", [
			z.object({
				type: z.literal("enabled"),
				budget_tokens: z.number().int().min(1024),
			}),
			z.object({ type: z.literal("disabled") }),
		])
		.optional(),
	tool_choice: ToolChoiceSchema.optional(),
	tools: z.array(AnthropicToolSchema).optional(),
	top_k: z.number().int().min(0).optional(),
	top_p: z.number().min(0).max(1).optional(),
});

export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;
export type AnthropicMessagesRequest = z.infer<
	typeof AnthropicMessagesRequestSchema
>;
