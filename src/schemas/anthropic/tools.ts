import { z } from "zod";
import { CacheControlEphemeralSchema } from "./common.ts";

export const InputSchemaSchema = z.object({
	type: z.literal("object"),
	properties: z.record(z.any()).nullable().optional(),
	required: z.array(z.string()).nullable().optional(),
});

export const ToolSchema = z.object({
	type: z.literal("custom").optional(),
	name: z
		.string()
		.min(1)
		.max(128)
		.regex(/^[a-zA-Z0-9_-]{1,128}$/),
	description: z.string().optional(),
	input_schema: InputSchemaSchema,
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const BashTool_20241022_Schema = z.object({
	name: z.literal("bash"),
	type: z.literal("bash_20241022"),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const BashTool_20250124_Schema = z.object({
	name: z.literal("bash"),
	type: z.literal("bash_20250124"),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const CodeExecutionTool_20250522_Schema = z.object({
	name: z.literal("code_execution"),
	type: z.literal("code_execution_20250522"),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const ComputerUseTool_20241022_Schema = z.object({
	name: z.literal("computer"),
	type: z.literal("computer_20241022"),
	display_height_px: z.number().int().min(1),
	display_width_px: z.number().int().min(1),
	display_number: z.number().int().min(0).nullable().optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const ComputerUseTool_20250124_Schema = z.object({
	name: z.literal("computer"),
	type: z.literal("computer_20250124"),
	display_height_px: z.number().int().min(1),
	display_width_px: z.number().int().min(1),
	display_number: z.number().int().min(0).nullable().optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const TextEditor_20241022_Schema = z.object({
	name: z.literal("str_replace_editor"),
	type: z.literal("text_editor_20241022"),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const TextEditor_20250124_Schema = z.object({
	name: z.literal("str_replace_editor"),
	type: z.literal("text_editor_20250124"),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const TextEditor_20250429_Schema = z.object({
	name: z.literal("str_replace_based_edit_tool"),
	type: z.literal("text_editor_20250429"),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const TextEditor_20250728_Schema = z.object({
	name: z.literal("str_replace_based_edit_tool"),
	type: z.literal("text_editor_20250728"),
	max_characters: z.number().int().min(1).nullable().optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const UserLocationSchema = z.object({
	type: z.literal("approximate"),
	city: z.string().min(1).max(255).nullable().optional(),
	country: z.string().length(2).nullable().optional(),
	region: z.string().min(1).max(255).nullable().optional(),
	timezone: z.string().min(1).max(255).nullable().optional(),
});

export const WebSearchTool_20250305_Schema = z.object({
	name: z.literal("web_search"),
	type: z.literal("web_search_20250305"),
	allowed_domains: z.array(z.string()).nullable().optional(),
	blocked_domains: z.array(z.string()).nullable().optional(),
	max_uses: z.number().int().gt(0).nullable().optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
	user_location: UserLocationSchema.nullable().optional(),
});

export const AnthropicToolSchema = z.union([
	ToolSchema,
	BashTool_20241022_Schema,
	BashTool_20250124_Schema,
	CodeExecutionTool_20250522_Schema,
	ComputerUseTool_20241022_Schema,
	ComputerUseTool_20250124_Schema,
	TextEditor_20241022_Schema,
	TextEditor_20250124_Schema,
	TextEditor_20250429_Schema,
	TextEditor_20250728_Schema,
	WebSearchTool_20250305_Schema,
]);

export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;
